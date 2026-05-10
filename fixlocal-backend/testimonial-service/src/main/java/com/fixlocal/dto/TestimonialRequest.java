package com.fixlocal.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TestimonialRequest {

    @NotBlank
    private String name;

    @NotBlank
    @jakarta.validation.constraints.Pattern(regexp = "^[^,]+,\\s*[^,]+,\\s*[^,]+$", message = "Use format: City, State, Country")
    private String city;

    @NotBlank
    private String role;

    @NotBlank
    private String quote;
}