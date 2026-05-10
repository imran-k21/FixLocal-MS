package com.fixlocal.service.impl;

import com.fixlocal.service.AdminService;
import com.fixlocal.dto.AdminStatsDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminServiceImpl implements AdminService {

    private final RestTemplate restTemplate;

    @Value("${internal.user-service.base-url:http://localhost:8082}")
    private String userServiceBaseUrl;

    @Value("${internal.booking-service.base-url:http://localhost:8084}")
    private String bookingServiceBaseUrl;

    @Value("${internal.chat-service.base-url:http://localhost:8085}")
    private String chatServiceBaseUrl;

    public Map<String, Object> getUsers(String role, int page, int size, String search) {
        URI uri = UriComponentsBuilder
                .fromHttpUrl(userServiceBaseUrl + "/internal/users/admin/users")
                .queryParam("role", role)
                .queryParam("page", page)
                .queryParam("size", size)
                .queryParamIfPresent("search", java.util.Optional.ofNullable(search))
                .build(true)
                .toUri();

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                uri,
                HttpMethod.GET,
                HttpEntity.EMPTY,
                new ParameterizedTypeReference<>() {
                }
        );

        return response.getBody() == null ? new LinkedHashMap<>() : response.getBody();
    }

    public void blockUser(String id) {
        restTemplate.put(userServiceBaseUrl + "/internal/users/{id}/block", null, id);
    }

    public void unblockUser(String id) {
        restTemplate.put(userServiceBaseUrl + "/internal/users/{id}/unblock", null, id);
    }

    public void deleteUser(String id) {
        restTemplate.delete(userServiceBaseUrl + "/internal/users/{id}", id);
    }

    public void verifyTradesperson(String id) {
        restTemplate.put(userServiceBaseUrl + "/internal/users/{id}/verify", null, id);
    }

    public Map<String, Object> getBookings(int page, int size) {
        URI uri = UriComponentsBuilder
                .fromHttpUrl(bookingServiceBaseUrl + "/internal/bookings/admin/bookings")
                .queryParam("page", page)
                .queryParam("size", size)
                .build(true)
                .toUri();

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                uri,
                HttpMethod.GET,
                HttpEntity.EMPTY,
                new ParameterizedTypeReference<>() {
                }
        );

        return response.getBody() == null ? new LinkedHashMap<>() : response.getBody();
    }

    public AdminStatsDTO getStats() {
        Map<String, Object> userStats = getMap(userServiceBaseUrl + "/internal/users/admin/stats");
        Map<String, Object> bookingStats = getMap(bookingServiceBaseUrl + "/internal/bookings/admin/stats");
        Map<String, Object> chatStats = getMap(chatServiceBaseUrl + "/internal/chat/admin/stats");

        AdminStatsDTO stats = new AdminStatsDTO();
        stats.setTotalUsers(getLong(userStats, "totalUsers"));
        stats.setTotalTradespersons(getLong(userStats, "totalTradespersons"));
        stats.setPendingVerifications(getLong(userStats, "pendingVerifications"));
        stats.setBlockedAccounts(getLong(userStats, "blockedAccounts"));
        stats.setAveragePlatformRating(getDouble(userStats, "averagePlatformRating"));

        stats.setTotalBookings(getLong(bookingStats, "totalBookings"));
        stats.setCompletedBookings(getLong(bookingStats, "completedBookings"));
        stats.setPendingBookings(getLong(bookingStats, "pendingBookings"));
        stats.setCancelledBookings(getLong(bookingStats, "cancelledBookings"));
        stats.setRejectedBookings(getLong(bookingStats, "rejectedBookings"));

        stats.setActiveConversations(getLong(chatStats, "activeConversations"));
        return stats;
    }

    private Map<String, Object> getMap(String url) {
        Map<String, Object> body = restTemplate.getForObject(url, Map.class);
        return body == null ? new LinkedHashMap<>() : body;
    }

    private long getLong(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value instanceof Number number) return number.longValue();
        if (value == null) return 0;
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (Exception e) {
            return 0;
        }
    }

    private double getDouble(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value instanceof Number number) return number.doubleValue();
        if (value == null) return 0;
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (Exception e) {
            return 0;
        }
    }
}
