package com.fixlocal.dto;

import com.fixlocal.enums.Role;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;
import lombok.Data;
import lombok.ToString;

@Data
public class RegisterRequest {

    @NotBlank(message = "Name is required")
    @Size(max = 100, message = "Name cannot exceed 100 characters")
    private String name;

    @Email(message = "Invalid email format")
    @NotBlank(message = "Email is required")
    private String email;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @ToString.Exclude
    private String password;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @ToString.Exclude
    private String encryptedPassword;

    private String encryptionKeyId;

    @NotBlank(message = "Phone number is required")
    @Pattern(regexp = "^\\+?[0-9]{7,15}$", message = "Enter a valid phone number")
    private String phone;

    @NotNull(message = "Role is required")
    private Role role;

    // Tradesperson-only fields

    @Size(max = 100, message = "Occupation too long")
    private String occupation;

    @Size(max = 150, message = "Working location too long")
    @Pattern(regexp = "^[^,]+,\\s*[^,]+,\\s*[^,]+$", message = "Use format: City, State, Country")
    private String workingCity;

    @Min(value = 0, message = "Experience cannot be negative")
    @Max(value = 60, message = "Experience unrealistic")
    private Integer experience;
}