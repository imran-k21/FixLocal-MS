package com.fixlocal.service.impl;

import com.fixlocal.service.AuthService;
import com.fixlocal.service.UserService;
import com.fixlocal.dto.*;
import com.fixlocal.entity.*;
import com.fixlocal.enums.*;
import com.fixlocal.repository.UserRepository;
import com.fixlocal.security.JwtService;
import com.fixlocal.security.PayloadEncryptionService;
import com.fixlocal.exception.*;
import com.fixlocal.util.LocationFormatUtil;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final UserService userService;
    private final PayloadEncryptionService payloadEncryptionService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {

        String email = request.getEmail().trim().toLowerCase();
        String password = payloadEncryptionService.resolvePassword(
                request.getPassword(),
                request.getEncryptedPassword(),
                request.getEncryptionKeyId(),
                "password"
        );

        if (userRepository.existsByEmail(email)) {
            throw new AuthException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }

        if (request.getRole() == null) {
            throw new AuthException(ErrorCode.ROLE_REQUIRED);
        }

        if (password.length() < 6) {
            throw new AuthException(ErrorCode.PASSWORD_TOO_SHORT);
        }

        if (request.getRole() == Role.TRADESPERSON) {
            if (request.getOccupation() == null || request.getWorkingCity() == null) {
                throw new AuthException(ErrorCode.TRADESPERSON_DETAILS_REQUIRED);
            }
        }

        String normalizedWorkingCity = null;
        if (request.getWorkingCity() != null && !request.getWorkingCity().isBlank()) {
            normalizedWorkingCity = LocationFormatUtil.normalizeCityStateCountry(request.getWorkingCity());
        }

        User user = User.builder()
                .name(request.getName())
                .email(email)
                .password(passwordEncoder.encode(password))
                .phone(request.getPhone())
                .role(request.getRole())
                .occupation(request.getOccupation())
                .workingCity(normalizedWorkingCity)
                .experience(request.getExperience() != null ? request.getExperience() : 0)
                .status(request.getRole() == Role.TRADESPERSON ? Status.AVAILABLE : null)
                .createdAt(LocalDateTime.now())
                .blocked(false)
                .build();

        userRepository.save(user);

        String token = jwtService.generateToken(email);

        log.info("New user registered: {}", email);

        return AuthResponse.builder()
                .token(token)
                .type("Bearer")
                .user(userService.mapToDTO(user))
                .build();
    }

    public AuthResponse login(LoginRequest request) {

        String email = request.getEmail().trim().toLowerCase();
        String password = payloadEncryptionService.resolvePassword(
                request.getPassword(),
                request.getEncryptedPassword(),
                request.getEncryptionKeyId(),
                "password"
        );

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AuthException(ErrorCode.INVALID_CREDENTIALS));

        if (user.isBlocked()) {
            throw new AuthException(ErrorCode.ACCOUNT_BLOCKED);
        }

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new AuthException(ErrorCode.INVALID_CREDENTIALS);
        }

        String token = jwtService.generateToken(email);

        log.info("User logged in: {}", email);

        return AuthResponse.builder()
                .token(token)
                .type("Bearer")
                .user(userService.mapToDTO(user))
                .build();
    }

    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        String newPassword = payloadEncryptionService.resolvePassword(
                request.getNewPassword(),
                request.getEncryptedNewPassword(),
                request.getEncryptionKeyId(),
                "newPassword"
        );
        String confirmPassword = payloadEncryptionService.resolvePassword(
                request.getConfirmPassword(),
                request.getEncryptedConfirmPassword(),
                request.getEncryptionKeyId(),
                "confirmPassword"
        );

        if (newPassword.length() < 6) {
            throw new AuthException(ErrorCode.PASSWORD_TOO_SHORT);
        }

        if (!newPassword.equals(confirmPassword)) {
            throw new AuthException(ErrorCode.PASSWORD_MISMATCH);
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AuthException(ErrorCode.USER_NOT_FOUND));

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        log.info("Password reset completed for {}", email);
    }

    @Override
    public EncryptionKeyResponse getEncryptionKey() {
        return payloadEncryptionService.getEncryptionKey();
    }
}