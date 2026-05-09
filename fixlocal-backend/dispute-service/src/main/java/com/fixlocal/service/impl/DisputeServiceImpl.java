
package com.fixlocal.service.impl;

import com.fixlocal.service.DisputeService;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.fixlocal.dto.DisputeDetailsDTO;
import com.fixlocal.dto.DisputeMessageRequest;
import com.fixlocal.dto.DisputeRequest;
import com.fixlocal.exception.ErrorCode;
import com.fixlocal.exception.DisputeException;
import com.fixlocal.entity.Dispute;
import com.fixlocal.enums.DisputeStatus;
import com.fixlocal.repository.DisputeRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DisputeServiceImpl implements DisputeService {

    private final DisputeRepository disputeRepository;
    private final RestTemplate restTemplate;

    @Value("${internal.user-service.base-url:http://localhost:8082}")
    private String userServiceBaseUrl;

    @Value("${internal.booking-service.base-url:http://localhost:8084}")
    private String bookingServiceBaseUrl;

    public Dispute createDispute(DisputeRequest request, Authentication authentication) {
        Map<String, Object> reporter;
        if (request.getReporterId() != null) {
            reporter = getUserById(request.getReporterId());
            if (reporter == null) {
                throw new DisputeException(ErrorCode.REPORTER_NOT_FOUND);
            }
        } else {
            reporter = getAuthenticatedUser(authentication);
        }

        Map<String, Object> booking = getBookingById(request.getBookingId());
        if (booking == null) {
            throw new DisputeException(ErrorCode.BOOKING_NOT_FOUND);
        }

        Dispute dispute = Dispute.builder()
                .bookingId(request.getBookingId())
                .reporterId(getString(reporter, "id"))
                .reason(request.getReason())
                .desiredOutcome(request.getDesiredOutcome())
                .build();

        return disputeRepository.save(dispute);
    }

    public List<DisputeDetailsDTO> getAllDisputesWithDetails() {
        Map<String, Map<String, Object>> userCache = new HashMap<>();
        Map<String, Map<String, Object>> bookingCache = new HashMap<>();

        return disputeRepository.findAll()
                .stream()
                .map(dispute -> mapToDetails(dispute, userCache, bookingCache))
                .collect(Collectors.toList());
    }

    public DisputeDetailsDTO getDisputeDetails(String id, Authentication authentication) {
        Dispute dispute = disputeRepository.findById(id)
                .orElseThrow(() -> new DisputeException(ErrorCode.DISPUTE_NOT_FOUND));

        Map<String, Object> requester = getAuthenticatedUser(authentication);

        if (!isAdmin(requester) && !isParticipant(getString(requester, "id"), dispute)) {
            throw new DisputeException(ErrorCode.DISPUTE_ACCESS_FORBIDDEN);
        }

        return mapToDetails(dispute, new HashMap<>(), new HashMap<>());
    }

    public List<Dispute> getDisputesByBookingId(String bookingId) {
        return disputeRepository.findByBookingId(bookingId);
    }

    public List<DisputeDetailsDTO> getDisputesForReporter(Authentication authentication) {
        Map<String, Object> reporter = getAuthenticatedUser(authentication);

        Map<String, Map<String, Object>> userCache = new HashMap<>();
        Map<String, Map<String, Object>> bookingCache = new HashMap<>();

        return disputeRepository.findByReporterId(getString(reporter, "id"))
                .stream()
                .map(dispute -> mapToDetails(dispute, userCache, bookingCache))
                .collect(Collectors.toList());
    }

    public DisputeDetailsDTO updateDispute(String id, Dispute updatedDispute, Authentication authentication) {
        Dispute existingDispute = disputeRepository.findById(id)
                .orElseThrow(() -> new DisputeException(ErrorCode.DISPUTE_NOT_FOUND));

        Map<String, Object> requester = getAuthenticatedUser(authentication);

        if (!isAdmin(requester) && !Objects.equals(getString(requester, "id"), existingDispute.getReporterId())) {
            throw new DisputeException(ErrorCode.DISPUTE_UPDATE_FORBIDDEN);
        }

        if (updatedDispute.getStatus() != null) {
            existingDispute.setStatus(updatedDispute.getStatus());
        }

        if (updatedDispute.getDesiredOutcome() != null) {
            existingDispute.setDesiredOutcome(updatedDispute.getDesiredOutcome());
        }

        Dispute saved = disputeRepository.save(existingDispute);
        return mapToDetails(saved, new HashMap<>(), new HashMap<>());
    }

    public Dispute addMessage(String disputeId,
                              Authentication authentication,
                              DisputeMessageRequest request) {

        Dispute dispute = disputeRepository.findById(disputeId)
                .orElseThrow(() -> new DisputeException(ErrorCode.DISPUTE_NOT_FOUND));

        Map<String, Object> sender = getAuthenticatedUser(authentication);

        if (!isAdmin(sender) && !isParticipant(getString(sender, "id"), dispute)) {
            throw new DisputeException(ErrorCode.DISPUTE_MESSAGE_FORBIDDEN);
        }

        if (dispute.getMessages() == null) {
            dispute.setMessages(new ArrayList<>());
        }

        dispute.getMessages().add(
                Dispute.DisputeMessage.builder()
                        .senderId(getString(sender, "id"))
                        .message(request.getMessage())
                        .build()
        );

        return disputeRepository.save(dispute);
    }

    private Map<String, Object> getAuthenticatedUser(Authentication authentication) {
        if (authentication == null) {
            throw new DisputeException(ErrorCode.AUTHENTICATION_REQUIRED);
        }

        String email = authentication.getName();
        return getUserByEmail(email);
    }

    private boolean isAdmin(Map<String, Object> user) {
        return user != null && "ADMIN".equalsIgnoreCase(getString(user, "role"));
    }

    private boolean isParticipant(String userId, Dispute dispute) {
        if (userId == null || dispute == null) {
            return false;
        }
        if (userId.equals(dispute.getReporterId())) {
            return true;
        }
        Map<String, Object> booking = getBookingById(dispute.getBookingId());
        return booking != null &&
                (Objects.equals(userId, getString(booking, "userId"))
                        || Objects.equals(userId, getString(booking, "tradespersonId")));
    }

    private DisputeDetailsDTO mapToDetails(Dispute dispute,
                                           Map<String, Map<String, Object>> userCache,
                                           Map<String, Map<String, Object>> bookingCache) {

        Map<String, Object> reporter = resolveUser(dispute.getReporterId(), userCache);
        Map<String, Object> booking = resolveBooking(dispute.getBookingId(), bookingCache);
        Map<String, Object> respondent = resolveRespondent(dispute, booking, reporter, userCache);

        List<DisputeDetailsDTO.MessageDTO> messageDTOS = buildMessageDTOs(dispute, userCache);

        return DisputeDetailsDTO.builder()
                .id(dispute.getId())
                .bookingId(dispute.getBookingId())
                .reason(dispute.getReason())
                .desiredOutcome(dispute.getDesiredOutcome())
                .status(dispute.getStatus())
                .createdAt(dispute.getCreatedAt())
                .reporter(toUserSummary(reporter))
                .respondent(toUserSummary(respondent))
                .booking(toBookingSummary(booking, userCache))
                .messages(messageDTOS)
                .aiTriage(buildAiTriage(dispute, booking, reporter, respondent, messageDTOS))
                .build();
    }

    private DisputeDetailsDTO.AITriage buildAiTriage(Dispute dispute,
                                                     Map<String, Object> booking,
                                                     Map<String, Object> reporter,
                                                     Map<String, Object> respondent,
                                                     List<DisputeDetailsDTO.MessageDTO> messages) {

        List<String> signals = new ArrayList<>();

        String reason = normalizeText(dispute.getReason());
        String desired = normalizeText(dispute.getDesiredOutcome());
        String bookingStatus = normalize(getString(booking, "status"));
        String reporterRole = normalize(getString(reporter, "role"));

        int urgencyScore = 35;

        if (containsAny(reason, "scam", "fraud", "stole", "theft", "police", "harass", "threat", "abuse", "unsafe")) {
            urgencyScore += 35;
            signals.add("Safety/fraud indicator found in reason");
        }

        if (containsAny(reason, "no show", "did not come", "late", "delay", "not responding", "unreachable")) {
            urgencyScore += 15;
            signals.add("Service delivery reliability concern");
        }

        if (containsAny(reason, "payment", "refund", "charged", "money", "amount", "overcharged")) {
            urgencyScore += 18;
            signals.add("Payment-related conflict");
        }

        if (containsAny(reason, "damage", "broken", "spoiled", "defect", "poor quality", "bad work")) {
            urgencyScore += 20;
            signals.add("Quality/damage claim");
        }

        if (containsAny(desired, "full refund", "refund", "compensation", "replace", "rework")) {
            urgencyScore += 10;
            signals.add("Monetary or corrective action requested");
        }

        if ("completed".equals(bookingStatus)) {
            urgencyScore += 8;
            signals.add("Booking already completed, post-service dispute");
        } else if ("en_route".equals(bookingStatus) || "arrived".equals(bookingStatus)) {
            urgencyScore += 6;
            signals.add("Dispute raised during active engagement");
        }

        if (messages != null && messages.size() >= 5) {
            urgencyScore += 8;
            signals.add("Long dispute conversation thread");
        }

        if ("user".equals(reporterRole) && containsAny(reason, "unsafe", "threat", "abuse")) {
            urgencyScore += 8;
            signals.add("Customer safety concern");
        }

        urgencyScore = Math.max(0, Math.min(100, urgencyScore));

        String severity;
        if (urgencyScore >= 75) {
            severity = "HIGH";
        } else if (urgencyScore >= 50) {
            severity = "MEDIUM";
        } else {
            severity = "LOW";
        }

        String suggestedStatus;
        if (urgencyScore >= 75) {
            suggestedStatus = DisputeStatus.UNDER_REVIEW.name();
        } else if (urgencyScore >= 50) {
            suggestedStatus = DisputeStatus.UNDER_REVIEW.name();
        } else {
            suggestedStatus = dispute.getStatus() == DisputeStatus.OPEN
                    ? DisputeStatus.OPEN.name()
                    : dispute.getStatus().name();
        }

        String recommendedAction;
        if (urgencyScore >= 75) {
            recommendedAction = "Escalate to senior admin, collect timeline evidence, and contact both parties within 2 hours.";
        } else if (containsAny(reason, "payment", "refund", "charged", "amount")) {
            recommendedAction = "Verify payment and booking status, then evaluate refund/partial compensation path.";
        } else if (containsAny(reason, "damage", "broken", "defect", "poor quality")) {
            recommendedAction = "Request photo/video proof and assess rework vs compensation resolution.";
        } else {
            recommendedAction = "Collect both sides' statements and attempt mediated resolution with clear next steps.";
        }

        if (signals.isEmpty()) {
            signals.add("General service disagreement");
        }

        String summary = buildAiSummary(dispute, booking, reporter, respondent, severity, signals);

        return DisputeDetailsDTO.AITriage.builder()
                .summary(summary)
                .severity(severity)
                .urgencyScore(urgencyScore)
                .suggestedStatus(suggestedStatus)
                .recommendedAction(recommendedAction)
                .signals(signals)
                .build();
    }

    private String buildAiSummary(Dispute dispute,
                                  Map<String, Object> booking,
                                  Map<String, Object> reporter,
                                  Map<String, Object> respondent,
                                  String severity,
                                  List<String> signals) {
        String reporterName = getString(reporter, "name");
        String respondentName = getString(respondent, "name");
        String bookingStatus = getString(booking, "status");
        String reason = safeText(dispute.getReason(), 140);

        String reporterDisplay = reporterName != null ? reporterName : "Reporter";
        String respondentDisplay = respondentName != null ? respondentName : "Respondent";
        String statusDisplay = bookingStatus != null ? bookingStatus : "UNKNOWN";

        return String.format(
                "%s raised a %s-severity dispute against %s for booking status %s. Primary concern: %s. Key signals: %s.",
                reporterDisplay,
                severity,
                respondentDisplay,
                statusDisplay,
                reason,
                String.join(", ", signals)
        );
    }

    private String normalizeText(String value) {
        if (value == null) return "";
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private boolean containsAny(String input, String... keywords) {
        if (input == null || input.isBlank()) {
            return false;
        }
        for (String keyword : keywords) {
            if (keyword != null && !keyword.isBlank() && input.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private String safeText(String value, int maxLen) {
        if (value == null || value.isBlank()) {
            return "No reason provided";
        }
        String normalized = value.trim().replaceAll("\\s+", " ");
        if (normalized.length() <= maxLen) {
            return normalized;
        }
        return normalized.substring(0, Math.max(0, maxLen - 3)) + "...";
    }

    private List<DisputeDetailsDTO.MessageDTO> buildMessageDTOs(Dispute dispute,
                                                                Map<String, Map<String, Object>> userCache) {
        List<Dispute.DisputeMessage> sourceMessages = dispute.getMessages();
        if (sourceMessages == null || sourceMessages.isEmpty()) {
            return new ArrayList<>();
        }

        return sourceMessages.stream()
                .map(msg -> {
                    Map<String, Object> sender = resolveUser(msg.getSenderId(), userCache);
                    return DisputeDetailsDTO.MessageDTO.builder()
                            .senderId(msg.getSenderId())
                            .senderName(getString(sender, "name") != null ? getString(sender, "name") : "Unknown")
                            .senderRole(getString(sender, "role") != null
                                    ? getString(sender, "role")
                                    : null)
                            .message(msg.getMessage())
                            .timestamp(msg.getTimestamp())
                            .build();
                })
                .collect(Collectors.toList());
    }

    private Map<String, Object> resolveBooking(String bookingId, Map<String, Map<String, Object>> cache) {
        if (bookingId == null) {
            return null;
        }
        if (cache.containsKey(bookingId)) {
            return cache.get(bookingId);
        }
        Map<String, Object> booking = getBookingById(bookingId);
        cache.put(bookingId, booking);
        return booking;
    }

    private Map<String, Object> resolveUser(String userId, Map<String, Map<String, Object>> cache) {
        if (userId == null) {
            return null;
        }
        if (cache.containsKey(userId)) {
            return cache.get(userId);
        }
        Map<String, Object> user = getUserById(userId);
        cache.put(userId, user);
        return user;
    }

    private Map<String, Object> resolveRespondent(Dispute dispute,
                                                  Map<String, Object> booking,
                                                  Map<String, Object> reporter,
                                                  Map<String, Map<String, Object>> cache) {
        if (booking == null) {
            return null;
        }

        String bookingUserId = getString(booking, "userId");
        String bookingTradespersonId = getString(booking, "tradespersonId");
        String reporterId = dispute.getReporterId();

        if (reporter != null) {
            String reporterUserId = getString(reporter, "id");
            if (Objects.equals(reporterUserId, bookingUserId)) {
                return resolveUser(bookingTradespersonId, cache);
            }
            if (Objects.equals(reporterUserId, bookingTradespersonId)) {
                return resolveUser(bookingUserId, cache);
            }
        }

        if (reporterId != null && Objects.equals(reporterId, bookingUserId)) {
            return resolveUser(bookingTradespersonId, cache);
        }

        if (reporterId != null && Objects.equals(reporterId, bookingTradespersonId)) {
            return resolveUser(bookingUserId, cache);
        }

        Map<String, Object> bookingUser = resolveUser(bookingUserId, cache);
        Map<String, Object> bookingTradesperson = resolveUser(bookingTradespersonId, cache);

        String reporterEmail = normalize(getString(reporter, "email"));
        String disputeReporterIdNormalized = normalize(reporterId);
        String bookingUserEmail = normalize(getString(bookingUser, "email"));
        String bookingTradespersonEmail = normalize(getString(bookingTradesperson, "email"));

        if (reporterEmail != null) {
            if (reporterEmail.equals(bookingUserEmail)) {
                return bookingTradesperson;
            }
            if (reporterEmail.equals(bookingTradespersonEmail)) {
                return bookingUser;
            }
        }

        if (disputeReporterIdNormalized != null) {
            if (disputeReporterIdNormalized.equals(bookingUserEmail)) {
                return bookingTradesperson;
            }
            if (disputeReporterIdNormalized.equals(bookingTradespersonEmail)) {
                return bookingUser;
            }
        }

        String reporterRole = normalize(getString(reporter, "role"));
        if ("user".equals(reporterRole) && bookingTradesperson != null) {
            return bookingTradesperson;
        }
        if ("tradesperson".equals(reporterRole) && bookingUser != null) {
            return bookingUser;
        }

        if (bookingTradesperson != null) {
            return bookingTradesperson;
        }
        return bookingUser;
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed.toLowerCase(Locale.ROOT);
    }

    private DisputeDetailsDTO.UserSummary toUserSummary(Map<String, Object> user) {
        if (user == null) {
            return null;
        }

        return DisputeDetailsDTO.UserSummary.builder()
                .id(getString(user, "id"))
                .name(getString(user, "name"))
                .email(getString(user, "email"))
                .phone(getString(user, "phone"))
                .role(getString(user, "role"))
                .build();
    }

    private DisputeDetailsDTO.BookingSummary toBookingSummary(Map<String, Object> booking,
                                                              Map<String, Map<String, Object>> userCache) {
        if (booking == null) {
            return null;
        }

        Map<String, Object> tradesperson = resolveUser(getString(booking, "tradespersonId"), userCache);
        Map<String, Object> user = resolveUser(getString(booking, "userId"), userCache);

        return DisputeDetailsDTO.BookingSummary.builder()
                .id(getString(booking, "id"))
                .status(getString(booking, "status"))
                .serviceDescription(getString(booking, "serviceDescription"))
                .serviceAddress(getString(booking, "serviceAddress"))
                .price(getDouble(booking, "price"))
                .userName(getString(user, "name") != null ? getString(user, "name") : getString(booking, "userName"))
                .userPhone(getString(user, "phone"))
                .tradespersonName(getString(tradesperson, "name"))
                .tradespersonPhone(getString(tradesperson, "phone"))
                .build();
    }

    private Map<String, Object> getUserByEmail(String email) {
        try {
            return restTemplate.getForObject(
                    userServiceBaseUrl + "/internal/users/by-email?email={email}",
                    Map.class,
                    email
            );
        } catch (Exception e) {
            throw new DisputeException(ErrorCode.USER_NOT_FOUND);
        }
    }

    private Map<String, Object> getUserById(String id) {
        try {
            return restTemplate.getForObject(
                    userServiceBaseUrl + "/internal/users/{id}",
                    Map.class,
                    id
            );
        } catch (Exception e) {
            return null;
        }
    }

    private Map<String, Object> getBookingById(String id) {
        try {
            return restTemplate.getForObject(
                    bookingServiceBaseUrl + "/internal/bookings/{id}",
                    Map.class,
                    id
            );
        } catch (Exception e) {
            return null;
        }
    }

    private String getString(Map<String, Object> map, String key) {
        if (map == null) return null;
        Object value = map.get(key);
        return value == null ? null : String.valueOf(value);
    }

    private Double getDouble(Map<String, Object> map, String key) {
        if (map == null) return null;
        Object value = map.get(key);
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        if (value == null) return null;
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
