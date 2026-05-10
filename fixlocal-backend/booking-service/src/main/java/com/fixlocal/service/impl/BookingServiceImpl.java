package com.fixlocal.service.impl;

import com.fixlocal.service.BookingService;
import com.fixlocal.dto.*;
import com.fixlocal.exception.BookingException;
import com.fixlocal.exception.ErrorCode;
import com.fixlocal.entity.*;
import com.fixlocal.enums.*;
import com.fixlocal.repository.BookingRepository;
import com.fixlocal.repository.UserRepository;
import com.fixlocal.util.LocationFormatUtil;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.beans.factory.annotation.Value;

import org.springframework.data.domain.*;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.data.mongodb.core.aggregation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpClientErrorException;

import com.mongodb.client.result.UpdateResult;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class BookingServiceImpl implements BookingService {

    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;
    private final RestTemplate restTemplate;

    @Value("${internal.notification-service.base-url:http://localhost:8086}")
    private String notificationServiceBaseUrl;

    @Value("${internal.location-service.base-url:http://localhost:8092}")
    private String locationServiceBaseUrl;

    // ======================================================
    // 🔐 Helper: Get logged-in user (BLOCK SAFE)
    // ======================================================
    private User getLoggedInUser() {

        String email = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BookingException(ErrorCode.USER_NOT_FOUND));

        if (user.isBlocked()) {
            throw new BookingException(ErrorCode.USER_ACCOUNT_BLOCKED);
        }

        return user;
    }

    // ======================================================
    // ✅ CREATE BOOKING
    // ======================================================
    @Transactional
    public Booking createBooking(BookingRequest request) {

        User user = getLoggedInUser();

        if (user.getRole() != Role.USER) {
            throw new BookingException(ErrorCode.USER_ROLE_REQUIRED);
        }

        String tradespersonId = request.getTradespersonId();

        User tradesperson = userRepository.findById(tradespersonId)
                .orElseThrow(() -> new BookingException(ErrorCode.TRADESPERSON_NOT_FOUND));

        if (tradesperson.getRole() != Role.TRADESPERSON) {
            throw new BookingException(ErrorCode.TRADESPERSON_NOT_ELIGIBLE);
        }

        if (tradesperson.isBlocked()) {
            throw new BookingException(ErrorCode.TRADESPERSON_BLOCKED);
        }

        if (tradesperson.getStatus() != Status.AVAILABLE) {
            throw new BookingException(ErrorCode.TRADESPERSON_BUSY);
        }

        boolean alreadyPending = bookingRepository
                .existsByUserIdAndTradespersonIdAndStatus(
                        user.getId(),
                        tradespersonId,
                        BookingStatus.PENDING
                );

        if (alreadyPending) {
            throw new BookingException(ErrorCode.PENDING_BOOKING_EXISTS);
        }

        String normalizedUserCity = LocationFormatUtil.normalizeCityStateCountry(request.getUserCity());

        Booking booking = Booking.builder()
                .userId(user.getId())
                .tradespersonId(tradespersonId)
                .serviceAddress(request.getServiceAddress())
                .serviceDescription(request.getServiceDescription())
                .userName(user.getName())
                .userPhone(user.getPhone())
                .userCity(normalizedUserCity)
                .userLatitude(request.getUserLatitude())
                .userLongitude(request.getUserLongitude())
                .price(request.getOfferAmount())
                .initialOfferAmount(request.getOfferAmount())
                .lastOfferBy(OfferSide.USER)
                .awaitingResponseFrom(OfferSide.TRADESPERSON)
                .status(BookingStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();

        booking.getOfferHistory().add(
                PriceOffer.builder()
                        .id(UUID.randomUUID().toString())
                        .amount(request.getOfferAmount())
                        .offeredBy(OfferSide.USER)
                        .message("Initial offer")
                        .build()
        );

        log.info("Booking created by user {} for tradesperson {}",
                user.getId(),
                tradespersonId);

        Booking saved = bookingRepository.save(booking);

        publishBookingEvent(saved,
                NotificationType.BOOKING_CREATED,
                "Booking created");

        return saved;
    }

    @Transactional
    public PriceOffer submitCounterOffer(String bookingId, PriceOfferRequest request) {

        User actor = getLoggedInUser();

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BookingException(ErrorCode.BOOKING_NOT_FOUND));

        validateOfferState(booking, actor);

        OfferSide actorSide = actor.getRole() == Role.USER
                ? OfferSide.USER
                : OfferSide.TRADESPERSON;

        if (!actorSide.equals(booking.getAwaitingResponseFrom())) {
            throw new BookingException(ErrorCode.NEGOTIATION_TURN_MISMATCH);
        }

        PriceOffer offer = PriceOffer.builder()
                .id(UUID.randomUUID().toString())
                .amount(request.getAmount())
                .message(request.getMessage())
                .offeredBy(actorSide)
                .build();

        booking.getOfferHistory().add(offer);
        booking.setLastOfferBy(actorSide);
        booking.setAwaitingResponseFrom(actorSide == OfferSide.USER
                ? OfferSide.TRADESPERSON
                : OfferSide.USER);
        booking.setPrice(request.getAmount());

        bookingRepository.save(booking);

        notifyOfferUpdate(
                booking,
                NotificationType.OFFER_SUBMITTED,
                "New offer submitted"
        );

        return offer;
    }

    @Transactional
    public Booking acceptOffer(String bookingId, String offerId) {

        User actor = getLoggedInUser();

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BookingException(ErrorCode.BOOKING_NOT_FOUND));

        validateOfferState(booking, actor);

        PriceOffer offer = booking.getOfferHistory().stream()
                .filter(o -> o.getId().equals(offerId))
                .findFirst()
                .orElseThrow(() -> new BookingException(ErrorCode.OFFER_NOT_FOUND));

        OfferSide actorSide = actor.getRole() == Role.USER
                ? OfferSide.USER
                : OfferSide.TRADESPERSON;

        if (offer.getOfferedBy() == actorSide) {
            throw new BookingException(ErrorCode.OFFER_SELF_ACCEPT_FORBIDDEN);
        }

        offer.setAccepted(true);
        offer.setAcceptedBy(actorSide);
        offer.setAcceptedAt(LocalDateTime.now());
        booking.setAcceptedOfferId(offer.getId());
        booking.setPrice(offer.getAmount());
        booking.setAwaitingResponseFrom(null);

        bookingRepository.save(booking);

        notifyOfferUpdate(
                booking,
                NotificationType.OFFER_ACCEPTED,
                "Offer accepted"
        );

        return booking;
    }

    private void validateOfferState(Booking booking, User actor) {

        if (booking.getStatus() != BookingStatus.PENDING) {
            throw new BookingException(ErrorCode.BOOKING_STATE_CONFLICT,
                    "Negotiations only allowed for pending bookings");
        }

        if (!booking.getUserId().equals(actor.getId())
                && !booking.getTradespersonId().equals(actor.getId())) {
            throw new BookingException(ErrorCode.BOOKING_ACCESS_FORBIDDEN);
        }
    }

    private void notifyOfferUpdate(Booking booking,
                                   NotificationType type,
                                   String message) {

        publishBookingEvent(booking, type, message);
    }
    // ======================================================
    // ✅ ACCEPT BOOKING (CONCURRENCY SAFE)
    // ======================================================
    @Transactional
    public Booking acceptBooking(String bookingId) {

        User loggedInUser = getLoggedInUser();

        if (loggedInUser.getRole() != Role.TRADESPERSON) {
            throw new BookingException(ErrorCode.TRADESPERSON_ROLE_REQUIRED);
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BookingException(ErrorCode.BOOKING_NOT_FOUND));

        if (!booking.getTradespersonId().equals(loggedInUser.getId())) {
            throw new BookingException(ErrorCode.BOOKING_ACCESS_FORBIDDEN);
        }

        if (booking.getStatus() != BookingStatus.PENDING) {
            throw new BookingException(ErrorCode.BOOKING_STATE_CONFLICT,
                    "Only pending bookings can be accepted");
        }

        Query query = new Query(
                Criteria.where("_id").is(loggedInUser.getId())
                        .and("status").is(Status.AVAILABLE)
        );

        Update update = new Update().set("status", Status.BUSY);

        UpdateResult result = mongoTemplate.updateFirst(query, update, User.class);

        if (result.getModifiedCount() == 0) {
            throw new BookingException(ErrorCode.ACTIVE_BOOKING_EXISTS);
        }

        booking.setStatus(BookingStatus.ACCEPTED);
        booking.setAcceptedAt(LocalDateTime.now());

        Booking saved = bookingRepository.save(booking);

        publishBookingEvent(saved,
                NotificationType.BOOKING_ACCEPTED,
                "Booking accepted");

        log.info("Booking {} accepted by tradesperson {}", bookingId, loggedInUser.getId());

        return saved;
    }

    // ======================================================
    // ✅ REJECT BOOKING
    // ======================================================
    @Transactional
    public Booking rejectBooking(String bookingId) {

        User loggedInUser = getLoggedInUser();

        if (loggedInUser.getRole() != Role.TRADESPERSON) {
            throw new BookingException(ErrorCode.TRADESPERSON_ROLE_REQUIRED);
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BookingException(ErrorCode.BOOKING_NOT_FOUND));

        if (!booking.getTradespersonId().equals(loggedInUser.getId())) {
            throw new BookingException(ErrorCode.BOOKING_ACCESS_FORBIDDEN);
        }

        if (booking.getStatus() != BookingStatus.PENDING) {
            throw new BookingException(ErrorCode.BOOKING_STATE_CONFLICT,
                    "Only pending bookings can be rejected");
        }

        booking.setStatus(BookingStatus.REJECTED);

        Booking saved = bookingRepository.save(booking);

        publishBookingEvent(saved,
                NotificationType.BOOKING_REJECTED,
                "Booking rejected");

        log.info("Booking {} rejected by tradesperson {}", bookingId, loggedInUser.getId());

        return saved;
    }

    // ======================================================
    // ✅ COMPLETE BOOKING
    // ======================================================
    @Transactional
    public Booking completeBooking(String bookingId) {

        User loggedInUser = getLoggedInUser();

        if (loggedInUser.getRole() != Role.TRADESPERSON) {
            throw new BookingException(ErrorCode.TRADESPERSON_ROLE_REQUIRED);
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BookingException(ErrorCode.BOOKING_NOT_FOUND));

        if (!booking.getTradespersonId().equals(loggedInUser.getId())) {
            throw new BookingException(ErrorCode.BOOKING_ACCESS_FORBIDDEN);
        }

        if (booking.getStatus() != BookingStatus.ACCEPTED
                && booking.getStatus() != BookingStatus.EN_ROUTE
                && booking.getStatus() != BookingStatus.ARRIVED) {
            throw new BookingException(ErrorCode.BOOKING_STATE_CONFLICT,
                    "Booking must be in progress to complete");
        }

        booking.setStatus(BookingStatus.COMPLETED);
        booking.setCompletedAt(LocalDateTime.now());

        Query query = new Query(
                Criteria.where("_id").is(loggedInUser.getId())
                        .and("status").in(Status.BUSY, Status.OFFLINE)
        );

        Update update = new Update().set("status", Status.AVAILABLE);

        mongoTemplate.updateFirst(query, update, User.class);

        Booking saved = bookingRepository.save(booking);

        publishBookingEvent(saved,
                NotificationType.BOOKING_COMPLETED,
                "Booking completed");

        log.info("Booking {} completed by tradesperson {}", bookingId, loggedInUser.getId());

        deleteLocationSafely(bookingId);

        return saved;
    }

    // ======================================================
    // ✅ CANCEL BOOKING
    // ======================================================
    @Transactional
    public Booking cancelBooking(String bookingId, String reason) {

        User loggedInUser = getLoggedInUser();

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() ->
                        new BookingException(ErrorCode.BOOKING_NOT_FOUND));

        BookingStatus currentStatus = booking.getStatus();

        if (currentStatus == BookingStatus.COMPLETED ||
                currentStatus == BookingStatus.REJECTED ||
                currentStatus == BookingStatus.CANCELLED) {

            throw new BookingException(ErrorCode.BOOKING_STATE_CONFLICT,
                    "This booking cannot be cancelled");
        }

        if (loggedInUser.getRole() == Role.USER) {

            if (!booking.getUserId().equals(loggedInUser.getId())) {
                throw new BookingException(ErrorCode.BOOKING_ACCESS_FORBIDDEN);
            }

            booking.setCancelledBy(CancellationBy.USER);

        } else if (loggedInUser.getRole() == Role.TRADESPERSON) {

            if (!booking.getTradespersonId().equals(loggedInUser.getId())) {
                throw new BookingException(ErrorCode.BOOKING_ACCESS_FORBIDDEN);
            }

            booking.setCancelledBy(CancellationBy.TRADESPERSON);

        } else {
            throw new BookingException(ErrorCode.BOOKING_ACCESS_FORBIDDEN);
        }

        if (currentStatus == BookingStatus.ACCEPTED ||
                currentStatus == BookingStatus.EN_ROUTE ||
                currentStatus == BookingStatus.ARRIVED) {

            Query query = new Query(
                    Criteria.where("_id").is(booking.getTradespersonId())
                            .and("status").is(Status.BUSY)
            );

            Update update = new Update().set("status", Status.AVAILABLE);

            mongoTemplate.updateFirst(query, update, User.class);
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationReason(reason);
        booking.setCancelledAt(LocalDateTime.now());

        Booking saved = bookingRepository.save(booking);

        publishBookingEvent(saved,
                NotificationType.BOOKING_CANCELLED,
                "Booking cancelled");

        log.info("Booking {} cancelled by {}", bookingId, loggedInUser.getRole());

        deleteLocationSafely(bookingId);

        return saved;
    }

    // ======================================================
    // GET METHODS
    // ======================================================

    public Booking getBookingById(String bookingId) {

        User loggedInUser = getLoggedInUser();

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() ->
                        new BookingException(ErrorCode.BOOKING_NOT_FOUND));

        if (!booking.getUserId().equals(loggedInUser.getId()) &&
                !booking.getTradespersonId().equals(loggedInUser.getId())) {

            throw new BookingException(ErrorCode.BOOKING_ACCESS_FORBIDDEN);
        }

        return booking;
    }

    public Page<Booking> getBookingsByUser(BookingStatus status, int page, int size) {

        User loggedInUser = getLoggedInUser();

        if (loggedInUser.getRole() != Role.USER) {
            throw new BookingException(ErrorCode.USER_ROLE_REQUIRED);
        }

        Pageable pageable = PageRequest.of(
                page,
                size,
                Sort.by("createdAt").descending()
        );

        return (status != null)
                ? bookingRepository.findByUserIdAndStatus(loggedInUser.getId(), status, pageable)
                : bookingRepository.findByUserId(loggedInUser.getId(), pageable);
    }

    public Page<Booking> getBookingsByTradesperson(BookingStatus status, int page, int size) {

        User loggedInUser = getLoggedInUser();

        if (loggedInUser.getRole() != Role.TRADESPERSON) {
            throw new BookingException(ErrorCode.TRADESPERSON_ROLE_REQUIRED);
        }

        Pageable pageable = PageRequest.of(
                page,
                size,
                Sort.by("createdAt").descending()
        );

        return (status != null)
                ? bookingRepository.findByTradespersonIdAndStatus(loggedInUser.getId(), status, pageable)
                : bookingRepository.findByTradespersonId(loggedInUser.getId(), pageable);
    }

    public BookingStatsDTO getBookingStats() {

        User loggedInUser = getLoggedInUser();

        Criteria criteria = (loggedInUser.getRole() == Role.USER)
                ? Criteria.where("userId").is(loggedInUser.getId())
                : Criteria.where("tradespersonId").is(loggedInUser.getId());

        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(criteria),
                Aggregation.group("status").count().as("count")
        );

        AggregationResults<org.bson.Document> results =
                mongoTemplate.aggregate(
                        aggregation,
                        Booking.class,
                        org.bson.Document.class
                );

        long total = 0;
        long pending = 0;
        long accepted = 0;
        long completed = 0;
        long cancelled = 0;
        long rejected = 0;

        for (org.bson.Document doc : results.getMappedResults()) {

            String status = doc.getString("_id");
            long count = ((Number) doc.get("count")).longValue();

            total += count;

            switch (status) {
                case "PENDING":
                    pending = count;
                    break;

                case "ACCEPTED":
                    accepted = count;
                    break;

                case "COMPLETED":
                    completed = count;
                    break;

                case "CANCELLED":
                    cancelled = count;
                    break;

                case "REJECTED":
                    rejected = count;
                    break;
            }
        }

        long active = accepted; // Active bookings = accepted bookings

        return new BookingStatsDTO(
                total,
                pending,
                accepted,
                completed,
                cancelled,
                rejected,
                active
        );
    }

    @Transactional
    public Booking startTrip(String bookingId) {

        User loggedInUser = getLoggedInUser();

        if (loggedInUser.getRole() != Role.TRADESPERSON) {
            throw new BookingException(ErrorCode.TRADESPERSON_ROLE_REQUIRED);
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() ->
                        new BookingException(ErrorCode.BOOKING_NOT_FOUND));

        if (!booking.getTradespersonId().equals(loggedInUser.getId())) {
            throw new BookingException(ErrorCode.BOOKING_ACCESS_FORBIDDEN);
        }

        if (booking.getStatus() != BookingStatus.ACCEPTED) {
            throw new BookingException(ErrorCode.BOOKING_STATE_CONFLICT,
                    "Trip can start only after acceptance");
        }

        booking.setStatus(BookingStatus.EN_ROUTE);
        booking.setEnRouteAt(LocalDateTime.now());

        userRepository.save(loggedInUser);

        Booking saved = bookingRepository.save(booking);

        publishBookingEvent(saved,
                NotificationType.BOOKING_EN_ROUTE,
                "Tradesperson en route");

        return saved;
    }

    @Transactional
    public Booking markArrived(String bookingId) {

        User loggedInUser = getLoggedInUser();

        if (loggedInUser.getRole() != Role.TRADESPERSON) {
            throw new BookingException(ErrorCode.TRADESPERSON_ROLE_REQUIRED);
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() ->
                        new BookingException(ErrorCode.BOOKING_NOT_FOUND));

        if (!booking.getTradespersonId().equals(loggedInUser.getId())) {
            throw new BookingException(ErrorCode.BOOKING_ACCESS_FORBIDDEN);
        }

        if (booking.getStatus() != BookingStatus.EN_ROUTE) {
            throw new BookingException(ErrorCode.BOOKING_STATE_CONFLICT,
                    "Arrival requires en-route state");
        }

        booking.setStatus(BookingStatus.ARRIVED);
        booking.setArrivedAt(LocalDateTime.now());

        Booking saved = bookingRepository.save(booking);

        publishBookingEvent(saved,
                NotificationType.BOOKING_ARRIVED,
                "Tradesperson arrived");

        return saved;
    }

    @Transactional
    public void updateLiveLocation(String bookingId,
                                   double latitude,
                                   double longitude) {

        User loggedInUser = getLoggedInUser();

        if (loggedInUser.getRole() != Role.TRADESPERSON) {
            throw new BookingException(ErrorCode.TRADESPERSON_ROLE_REQUIRED);
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() ->
                        new BookingException(ErrorCode.BOOKING_NOT_FOUND));

        if (!booking.getTradespersonId().equals(loggedInUser.getId())) {
            throw new BookingException(ErrorCode.BOOKING_ACCESS_FORBIDDEN);
        }

        if (booking.getStatus() == BookingStatus.CANCELLED ||
                booking.getStatus() == BookingStatus.REJECTED ||
                booking.getStatus() == BookingStatus.COMPLETED) {
            throw new BookingException(ErrorCode.LIVE_LOCATION_UPDATE_FORBIDDEN);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tradespersonId", loggedInUser.getId());
        payload.put("latitude", latitude);
        payload.put("longitude", longitude);

        try {
            restTemplate.put(
                    locationServiceBaseUrl + "/internal/location/bookings/{bookingId}",
                    payload,
                    bookingId
            );
        } catch (Exception ex) {
            throw new BookingException(
                    ErrorCode.EXTERNAL_SERVICE_ERROR,
                    "Unable to update live location"
            );
        }
    }

    public LiveLocationEvent getLiveLocation(String bookingId) {

        User loggedInUser = getLoggedInUser();

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() ->
                        new BookingException(ErrorCode.BOOKING_NOT_FOUND));

        if (!booking.getUserId().equals(loggedInUser.getId())
                && !booking.getTradespersonId().equals(loggedInUser.getId())) {
            throw new BookingException(ErrorCode.BOOKING_ACCESS_FORBIDDEN);
        }

        try {
            LiveLocationEvent event = restTemplate.getForObject(
                    locationServiceBaseUrl + "/internal/location/bookings/{bookingId}",
                    LiveLocationEvent.class,
                    bookingId
            );

            if (event == null) {
                throw new BookingException(ErrorCode.LIVE_LOCATION_NOT_FOUND);
            }

            return event;
        } catch (HttpClientErrorException.NotFound ex) {
            throw new BookingException(ErrorCode.LIVE_LOCATION_NOT_FOUND);
        } catch (BookingException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BookingException(
                    ErrorCode.EXTERNAL_SERVICE_ERROR,
                    "Unable to fetch live location"
            );
        }
    }

    public InternalBookingDTO getInternalBookingById(String bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BookingException(ErrorCode.BOOKING_NOT_FOUND));

        return toInternalBookingDTO(booking);
    }

    public Page<InternalBookingDTO> getAdminBookings(Pageable pageable) {
        return bookingRepository.findAll(pageable)
                .map(this::toInternalBookingDTO);
    }

    public InternalAdminBookingStatsDTO getAdminBookingStats() {
        return InternalAdminBookingStatsDTO.builder()
                .totalBookings(bookingRepository.count())
                .completedBookings(bookingRepository.countByStatus(BookingStatus.COMPLETED))
                .pendingBookings(bookingRepository.countByStatus(BookingStatus.PENDING))
                .cancelledBookings(bookingRepository.countByStatus(BookingStatus.CANCELLED))
                .rejectedBookings(bookingRepository.countByStatus(BookingStatus.REJECTED))
                .build();
    }

    public Map<String, Long> getUserStatusCounts(String userId) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (BookingStatus status : BookingStatus.values()) {
            counts.put(status.name(), bookingRepository.countByUserIdAndStatus(userId, status));
        }
        counts.put("TOTAL", bookingRepository.countByUserId(userId));
        return counts;
    }

    public Map<String, Long> getTradespersonStatusCounts(String tradespersonId) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (BookingStatus status : BookingStatus.values()) {
            counts.put(status.name(), bookingRepository.countByTradespersonIdAndStatus(tradespersonId, status));
        }
        counts.put("TOTAL", bookingRepository.countByTradespersonId(tradespersonId));
        return counts;
    }

    @Transactional
    public void applyReviewUpdate(String bookingId, InternalReviewUpdateRequest request) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BookingException(ErrorCode.BOOKING_NOT_FOUND, "Booking not found"));

        booking.setReviewSubmitted(true);
        booking.setUserRating(request.getRating());
        booking.setReviewedAt(LocalDateTime.now());
        booking.setReviewId(request.getReviewId());

        bookingRepository.save(booking);
    }

    private void publishBookingEvent(Booking booking,
                                     NotificationType type,
                                     String message) {
        switch (type) {
            case BOOKING_CREATED ->
                    sendNotificationSafely(booking.getTradespersonId(), message, type);

            case BOOKING_ACCEPTED,
                 BOOKING_REJECTED,
                 BOOKING_COMPLETED,
                 BOOKING_EN_ROUTE,
                 BOOKING_ARRIVED ->
                    sendNotificationSafely(booking.getUserId(), message, type);

            case BOOKING_CANCELLED -> {
                if (booking.getCancelledBy() == CancellationBy.USER) {
                    sendNotificationSafely(booking.getTradespersonId(), message, type);
                } else if (booking.getCancelledBy() == CancellationBy.TRADESPERSON) {
                    sendNotificationSafely(booking.getUserId(), message, type);
                } else {
                    sendNotificationSafely(booking.getUserId(), message, type);
                    sendNotificationSafely(booking.getTradespersonId(), message, type);
                }
            }

            case OFFER_SUBMITTED -> {
                if (booking.getAwaitingResponseFrom() == OfferSide.USER) {
                    sendNotificationSafely(booking.getUserId(), message, type);
                } else if (booking.getAwaitingResponseFrom() == OfferSide.TRADESPERSON) {
                    sendNotificationSafely(booking.getTradespersonId(), message, type);
                }
            }

            case OFFER_ACCEPTED -> {
                sendNotificationSafely(booking.getUserId(), message, type);
                sendNotificationSafely(booking.getTradespersonId(), message, type);
            }
        }
    }

    private void sendNotificationSafely(String userId,
                                        String message,
                                        NotificationType type) {
        if (userId == null || userId.isBlank()) {
            return;
        }

        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("userId", userId);
            payload.put("message", message);
            payload.put("type", type);

            restTemplate.postForEntity(
                    notificationServiceBaseUrl + "/internal/notifications",
                    payload,
                    Void.class
            );

        } catch (Exception ex) {
            log.warn("Failed to publish notification for booking {} to user {}: {}",
                    userId,
                    type,
                    ex.getMessage());
        }
    }

    private void deleteLocationSafely(String bookingId) {
        if (bookingId == null || bookingId.isBlank()) {
            return;
        }

        try {
            restTemplate.delete(
                    locationServiceBaseUrl + "/internal/location/bookings/{bookingId}",
                    bookingId
            );
        } catch (Exception ex) {
            log.warn("Failed to delete location for booking {}: {}", bookingId, ex.getMessage());
        }
    }

    private InternalBookingDTO toInternalBookingDTO(Booking booking) {
        return InternalBookingDTO.builder()
                .id(booking.getId())
                .userId(booking.getUserId())
                .tradespersonId(booking.getTradespersonId())
                .status(booking.getStatus() != null ? booking.getStatus().name() : null)
                .serviceDescription(booking.getServiceDescription())
                .serviceAddress(booking.getServiceAddress())
                .price(booking.getPrice())
                .userName(booking.getUserName())
                .userPhone(booking.getUserPhone())
                .build();
    }

}