package com.fixlocal.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class UpdateUserRequest {

    @NotBlank
    private String name;

    @NotBlank
    @jakarta.validation.constraints.Pattern(regexp = "^[^,]+,\\s*[^,]+,\\s*[^,]+$", message = "Use format: City, State, Country")
    private String workingCity;

    private String bio;

    private String phone;

    private List<String> skillTags;
}