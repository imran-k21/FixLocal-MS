package com.fixlocal.service;

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

public interface AdminService {
    public Map<String, Object> getUsers(String role, int page, int size, String search);
    public void blockUser(String id);
    public void unblockUser(String id);
    public void deleteUser(String id);
    public void verifyTradesperson(String id);
    public Map<String, Object> getBookings(int page, int size);
    public AdminStatsDTO getStats();
}
