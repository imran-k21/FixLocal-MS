package com.fixlocal.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.fixlocal.enums.DisputeStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DisputeDetailsDTO {

    private String id;
    private String bookingId;
    private String reason;
    private String desiredOutcome;
    private DisputeStatus status;
    private LocalDateTime createdAt;

    private UserSummary reporter;
    private UserSummary respondent;
    private BookingSummary booking;
    private List<MessageDTO> messages;
    private AITriage aiTriage;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AITriage {
        private String summary;
        private String severity;
        private Integer urgencyScore;
        private String suggestedStatus;
        private String recommendedAction;
        private List<String> signals;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserSummary {
        private String id;
        private String name;
        private String email;
        private String phone;
        private String role;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BookingSummary {
        private String id;
        private String status;
        private String serviceDescription;
        private String serviceAddress;
        private Double price;
        private String userName;
        private String userPhone;
        private String tradespersonName;
        private String tradespersonPhone;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MessageDTO {
        private String senderId;
        private String senderName;
        private String senderRole;
        private String message;
        private LocalDateTime timestamp;
    }
}