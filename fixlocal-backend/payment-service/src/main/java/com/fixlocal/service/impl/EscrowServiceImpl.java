package com.fixlocal.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fixlocal.dto.PaymentInitiateResponse;
import com.fixlocal.dto.PaymentVerificationRequest;
import com.fixlocal.entity.Booking;
import com.fixlocal.service.EscrowService;
import com.fixlocal.exception.ErrorCode;
import com.fixlocal.exception.PaymentException;
import com.fixlocal.enums.BookingStatus;
import com.fixlocal.enums.PaymentStatus;
import com.fixlocal.enums.Role;
import com.fixlocal.gateway.RazorpayGatewayClient;
import com.fixlocal.gateway.RazorpayOrderResponse;
import com.fixlocal.gateway.RazorpaySignatureService;
import com.fixlocal.repository.BookingRepository;
import com.fixlocal.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class EscrowServiceImpl implements EscrowService {

    private static final String ORDER_PREFIX = "rp_order:";
    private static final String PAYMENT_PREFIX = "rp_payment:";

    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final RazorpayGatewayClient razorpayGatewayClient;
    private final RazorpaySignatureService razorpaySignatureService;
    private final ObjectMapper objectMapper;

    @Value("${payment.razorpay.currency:INR}")
    private String paymentCurrency;

    @Transactional
    public PaymentInitiateResponse initiatePayment(String bookingId, double amount) {

        if (amount <= 0) {
            throw new PaymentException(ErrorCode.PAYMENT_AMOUNT_INVALID);
        }

        Booking booking = getBooking(bookingId);
        String userId = getLoggedInUserId();

        ensureParticipant(booking, userId);
        ensureRole(userId, Role.USER);

        if (booking.getPaymentStatus() == PaymentStatus.CAPTURED) {
            throw new PaymentException(ErrorCode.PAYMENT_ALREADY_CAPTURED);
        }

        if (booking.getPaymentStatus() == PaymentStatus.AUTHORIZED) {
            throw new PaymentException(ErrorCode.PAYMENT_IN_PROGRESS);
        }

        long amountInPaise = toPaise(amount);
        RazorpayOrderResponse order = razorpayGatewayClient.createOrder(
                amountInPaise,
                paymentCurrency,
                buildReceipt(bookingId),
                bookingId
        );

        booking.setPaymentStatus(null);
        booking.setPaymentIntentId(composeOrderIntent(order.getId()));
        booking.setPrice(amount);
        Booking saved = bookingRepository.save(booking);

        return PaymentInitiateResponse.builder()
                .booking(saved)
                .orderId(order.getId())
                .keyId(razorpayGatewayClient.getKeyId())
                .currency(order.getCurrency())
                .amount(order.getAmount())
                .build();
    }

    @Transactional
    @Override
    public Booking authorizePayment(String bookingId) {
        throw new PaymentException(ErrorCode.BAD_REQUEST,
                "Manual authorization is disabled. Use /payments/verify with gateway signature or webhook");
    }

    @Transactional
    @Override
    public Booking capturePayment(String bookingId) {

        Booking booking = getBooking(bookingId);
        String userId = getLoggedInUserId();

        ensureParticipant(booking, userId);
        ensureRole(userId, Role.USER);
        ensureIntentExists(booking);

        if (booking.getPaymentStatus() != PaymentStatus.AUTHORIZED) {
            throw new PaymentException(ErrorCode.PAYMENT_STATUS_INVALID,
                    "Payment can be captured only after authorization");
        }

        if (booking.getStatus() != BookingStatus.COMPLETED) {
            throw new PaymentException(ErrorCode.PAYMENT_CAPTURE_NOT_ALLOWED);
        }

        String paymentId = extractPaymentId(booking.getPaymentIntentId());
        if (paymentId == null || paymentId.isBlank()) {
            throw new PaymentException(ErrorCode.PAYMENT_INTENT_MISSING,
                    "Payment ID missing. Please verify payment first");
        }

        long amountInPaise = toPaise(booking.getPrice());
        razorpayGatewayClient.capturePayment(paymentId, amountInPaise, paymentCurrency);

        booking.setPaymentStatus(PaymentStatus.CAPTURED);
        return bookingRepository.save(booking);
    }

    @Transactional
    @Override
    public Booking refundPayment(String bookingId) {

        Booking booking = getBooking(bookingId);
        String userId = getLoggedInUserId();

        ensureParticipant(booking, userId);
        ensureRole(userId, Role.USER);
        ensureIntentExists(booking);

        if (booking.getPaymentStatus() == PaymentStatus.REFUNDED) {
            throw new PaymentException(ErrorCode.PAYMENT_ALREADY_REFUNDED);
        }

        if (booking.getPaymentStatus() != PaymentStatus.CAPTURED) {
            throw new PaymentException(ErrorCode.PAYMENT_STATUS_INVALID,
                    "Only captured payments can be refunded");
        }

        String paymentId = extractPaymentId(booking.getPaymentIntentId());
        if (paymentId == null || paymentId.isBlank()) {
            throw new PaymentException(ErrorCode.PAYMENT_INTENT_MISSING,
                    "Payment ID missing. Unable to refund");
        }

        long amountInPaise = toPaise(booking.getPrice());
        razorpayGatewayClient.refundPayment(paymentId, amountInPaise);

        booking.setPaymentStatus(PaymentStatus.REFUNDED);
        return bookingRepository.save(booking);
    }

    @Transactional
    @Override
    public Booking verifyPayment(String bookingId, PaymentVerificationRequest request) {
        Booking booking = getBooking(bookingId);
        String userId = getLoggedInUserId();

        ensureParticipant(booking, userId);
        ensureRole(userId, Role.USER);
        ensureIntentExists(booking);

        if (booking.getPaymentStatus() == PaymentStatus.CAPTURED) {
            throw new PaymentException(ErrorCode.PAYMENT_STATUS_INVALID,
                    "Payment is already captured for this booking");
        }

        String expectedOrderId = extractOrderId(booking.getPaymentIntentId());
        if (expectedOrderId == null || expectedOrderId.isBlank()) {
            throw new PaymentException(ErrorCode.PAYMENT_INTENT_MISSING,
                    "Order ID missing from payment intent");
        }

        if (!expectedOrderId.equals(request.getOrderId())) {
            throw new PaymentException(ErrorCode.PAYMENT_STATUS_INVALID,
                    "Order mismatch for this booking");
        }

        boolean valid = razorpaySignatureService.isPaymentSignatureValid(
                request.getOrderId(),
                request.getPaymentId(),
                request.getSignature()
        );
        if (!valid) {
            throw new PaymentException(ErrorCode.PAYMENT_SIGNATURE_INVALID);
        }

        booking.setPaymentStatus(PaymentStatus.AUTHORIZED);
        booking.setPaymentIntentId(composePaymentIntent(request.getOrderId(), request.getPaymentId()));
        return bookingRepository.save(booking);
    }

    @Transactional
    @Override
    public void handleWebhook(String signature, String payload) {
        if (signature == null || signature.isBlank()) {
            throw new PaymentException(ErrorCode.PAYMENT_SIGNATURE_INVALID,
                    "Missing Razorpay webhook signature");
        }

        if (!razorpaySignatureService.isWebhookSignatureValid(payload, signature)) {
            throw new PaymentException(ErrorCode.PAYMENT_SIGNATURE_INVALID,
                    "Invalid Razorpay webhook signature");
        }

        try {
            JsonNode root = objectMapper.readTree(payload);
            String event = root.path("event").asText("");
            JsonNode paymentEntity = root.path("payload").path("payment").path("entity");
            if (paymentEntity.isMissingNode()) {
                return;
            }

            String orderId = paymentEntity.path("order_id").asText("");
            String paymentId = paymentEntity.path("id").asText("");
            if (orderId.isBlank()) {
                return;
            }

            Optional<Booking> bookingOpt = findBookingByOrderId(orderId);
            if (bookingOpt.isEmpty()) {
                log.warn("Webhook received for unknown order {}", orderId);
                return;
            }

            Booking booking = bookingOpt.get();
            switch (event) {
                case "payment.authorized" -> {
                    booking.setPaymentStatus(PaymentStatus.AUTHORIZED);
                    booking.setPaymentIntentId(composePaymentIntent(orderId, paymentId));
                }
                case "payment.captured" -> {
                    booking.setPaymentStatus(PaymentStatus.CAPTURED);
                    booking.setPaymentIntentId(composePaymentIntent(orderId, paymentId));
                }
                case "payment.failed" -> booking.setPaymentStatus(PaymentStatus.FAILED);
                case "payment.refunded", "refund.processed" -> booking.setPaymentStatus(PaymentStatus.REFUNDED);
                default -> {
                    return;
                }
            }

            bookingRepository.save(booking);
        } catch (PaymentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new PaymentException(ErrorCode.BAD_REQUEST,
                    "Unable to process Razorpay webhook payload");
        }
    }

    private Booking getBooking(String bookingId) {
        return bookingRepository.findById(bookingId)
                .orElseThrow(() -> new PaymentException(ErrorCode.BOOKING_NOT_FOUND));
    }

    private void ensureIntentExists(Booking booking) {
        if (booking.getPaymentIntentId() == null || booking.getPaymentIntentId().isBlank()) {
            throw new PaymentException(ErrorCode.PAYMENT_INTENT_MISSING);
        }
    }

    private Optional<Booking> findBookingByOrderId(String orderId) {
        String orderIntentPrefix = composeOrderIntent(orderId);
        return bookingRepository.findByPaymentIntentId(orderIntentPrefix)
                .or(() -> bookingRepository.findFirstByPaymentIntentIdStartingWith(orderIntentPrefix))
                .or(() -> bookingRepository.findFirstByPaymentIntentIdEndingWith(orderIntentPrefix));
    }

    private String composeOrderIntent(String orderId) {
        return ORDER_PREFIX + orderId;
    }

    private String composePaymentIntent(String orderId, String paymentId) {
        if (paymentId == null || paymentId.isBlank()) {
            return composeOrderIntent(orderId);
        }
        return composeOrderIntent(orderId) + "|" + PAYMENT_PREFIX + paymentId;
    }

    private String extractOrderId(String paymentIntentId) {
        if (paymentIntentId == null || !paymentIntentId.startsWith(ORDER_PREFIX)) {
            return null;
        }
        int splitIndex = paymentIntentId.indexOf('|');
        if (splitIndex < 0) {
            return paymentIntentId.substring(ORDER_PREFIX.length());
        }
        return paymentIntentId.substring(ORDER_PREFIX.length(), splitIndex);
    }

    private String extractPaymentId(String paymentIntentId) {
        if (paymentIntentId == null || paymentIntentId.isBlank()) {
            return null;
        }

        String normalizedIntent = paymentIntentId.trim();
        String extractedPaymentId = null;

        String marker = "|" + PAYMENT_PREFIX;
        int markerIndex = normalizedIntent.indexOf(marker);
        if (markerIndex >= 0) {
            extractedPaymentId = normalizedIntent.substring(markerIndex + marker.length());
        } else if (normalizedIntent.startsWith(PAYMENT_PREFIX)) {
            extractedPaymentId = normalizedIntent.substring(PAYMENT_PREFIX.length());
        } else if (normalizedIntent.startsWith("pay_")) {
            extractedPaymentId = normalizedIntent;
        }

        if (extractedPaymentId == null || extractedPaymentId.isBlank()) {
            return null;
        }

        int nextPipeIndex = extractedPaymentId.indexOf('|');
        if (nextPipeIndex >= 0) {
            extractedPaymentId = extractedPaymentId.substring(0, nextPipeIndex);
        }

        int firstSpaceIndex = extractedPaymentId.indexOf(' ');
        if (firstSpaceIndex >= 0) {
            extractedPaymentId = extractedPaymentId.substring(0, firstSpaceIndex);
        }

        extractedPaymentId = extractedPaymentId.trim();
        return extractedPaymentId.isBlank() ? null : extractedPaymentId;
    }

    private long toPaise(Double amount) {
        if (amount == null || amount <= 0) {
            throw new PaymentException(ErrorCode.PAYMENT_AMOUNT_INVALID);
        }
        return Math.round(amount * 100);
    }

    private long toPaise(double amount) {
        if (amount <= 0) {
            throw new PaymentException(ErrorCode.PAYMENT_AMOUNT_INVALID);
        }
        return Math.round(amount * 100);
    }

    private String buildReceipt(String bookingId) {
        String compactId = bookingId == null ? "unknown" : bookingId.replaceAll("[^a-zA-Z0-9_-]", "");
        if (compactId.length() > 22) {
            compactId = compactId.substring(0, 22);
        }
        return "fixlocal_" + compactId + "_" + (System.currentTimeMillis() % 100000);
    }

    private String getLoggedInUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new PaymentException(ErrorCode.UNAUTHORIZED);
        }

        return userRepository.findByEmail(authentication.getName())
                .map(user -> user.getId())
                .orElseThrow(() -> new PaymentException(ErrorCode.UNAUTHORIZED));
    }

    private void ensureParticipant(Booking booking, String userId) {
        if (!userId.equals(booking.getUserId()) && !userId.equals(booking.getTradespersonId())) {
            throw new PaymentException(ErrorCode.PAYMENT_OPERATION_FORBIDDEN);
        }
    }

    private void ensureRole(String userId, Role expectedRole) {
        boolean allowed = userRepository.findById(userId)
                .map(user -> expectedRole == user.getRole())
                .orElse(false);

        if (!allowed) {
            throw new PaymentException(ErrorCode.PAYMENT_OPERATION_FORBIDDEN);
        }
    }
}
