package com.fixlocal.service;

import com.fixlocal.dto.ServiceOfferingDTO;
import com.fixlocal.dto.InternalAdminUserStatsDTO;
import com.fixlocal.dto.InternalUserDTO;
import com.fixlocal.dto.ServiceOfferingRequest;
import com.fixlocal.dto.UpdateUserRequest;
import com.fixlocal.dto.UserResponseDTO;
import com.fixlocal.exception.UserException;
import com.fixlocal.enums.Role;
import com.fixlocal.entity.ServiceOffering;
import com.fixlocal.enums.Status;
import com.fixlocal.entity.User;
import com.fixlocal.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

public interface UserService {
    public InternalUserDTO getInternalUserById(String id);
    public InternalUserDTO getInternalUserByEmail(String email);
    public void applyTradespersonRating(String tradespersonId, int newRating);
    public Page<UserResponseDTO> getAdminUsers(Role role, Pageable pageable, String search);
    public void blockUserInternal(String userId);
    public void unblockUserInternal(String userId);
    public void deleteUserInternal(String userId);
    public void verifyTradespersonInternal(String userId);
    public InternalAdminUserStatsDTO getAdminUserStats();
    public UserResponseDTO getMyProfile(String email);
    public UserResponseDTO getDashboardProfileByEmail(String email);
    public UserResponseDTO updateMyProfile(String email, UpdateUserRequest request);
    public UserResponseDTO toggleAvailability(String email, boolean available);
    public UserResponseDTO updateSkillTags(String email, List<String> tags);
    public UserResponseDTO addServiceOffering(String email, ServiceOfferingRequest request);
    public UserResponseDTO updateServiceOffering(String email, String serviceId, ServiceOfferingRequest request);
    public UserResponseDTO deleteServiceOffering(String email, String serviceId);
    public void deleteMyAccount(String email);
    public UserResponseDTO mapToDTO(User user);
}
