package com.fixlocal.controller;

import com.fixlocal.dto.InternalAdminUserStatsDTO;
import com.fixlocal.dto.InternalUserDTO;
import com.fixlocal.dto.UserResponseDTO;
import com.fixlocal.enums.Role;
import com.fixlocal.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/users")
@RequiredArgsConstructor
public class InternalUserController {

    private final UserService userService;

    @GetMapping("/{id}")
    public InternalUserDTO getById(@PathVariable String id) {
        return userService.getInternalUserById(id);
    }

    @GetMapping("/by-email")
    public InternalUserDTO getByEmail(@RequestParam String email) {
        return userService.getInternalUserByEmail(email);
    }

    @GetMapping("/dashboard-profile")
    public UserResponseDTO getDashboardProfile(@RequestParam String email) {
        return userService.getDashboardProfileByEmail(email);
    }

    @PutMapping("/{id}/ratings/{rating}")
    public ResponseEntity<Void> applyRating(
            @PathVariable String id,
            @PathVariable int rating
    ) {
        userService.applyTradespersonRating(id, rating);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/admin/users")
    public Page<UserResponseDTO> getAdminUsers(
            @RequestParam(defaultValue = "USER") String role,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search
    ) {
        Pageable pageable = PageRequest.of(page, size);
        return userService.getAdminUsers(Role.valueOf(role.toUpperCase()), pageable, search);
    }

    @PutMapping("/{id}/block")
    public ResponseEntity<Void> block(@PathVariable String id) {
        userService.blockUserInternal(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/unblock")
    public ResponseEntity<Void> unblock(@PathVariable String id) {
        userService.unblockUserInternal(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable String id) {
        userService.deleteUserInternal(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/verify")
    public ResponseEntity<Void> verify(@PathVariable String id) {
        userService.verifyTradespersonInternal(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/admin/stats")
    public InternalAdminUserStatsDTO getAdminStats() {
        return userService.getAdminUserStats();
    }
}
