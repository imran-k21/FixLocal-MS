package com.fixlocal.util;

import java.util.Arrays;
import java.util.regex.Pattern;

public final class LocationFormatUtil {

    private static final Pattern MULTI_SPACE = Pattern.compile("\\s+");

    private LocationFormatUtil() {
    }

    public static String normalizeCityStateCountry(String rawLocation) {
        if (rawLocation == null) {
            throw new IllegalArgumentException("Location is required");
        }

        String[] parts = Arrays.stream(rawLocation.split(","))
                .map(LocationFormatUtil::normalizeWhitespace)
                .filter(part -> !part.isBlank())
                .toArray(String[]::new);

        if (parts.length != 3) {
            throw new IllegalArgumentException("Location must be in format: City, State, Country");
        }

        return String.join(", ", parts);
    }

    private static String normalizeWhitespace(String value) {
        return MULTI_SPACE.matcher(value == null ? "" : value.trim())
                .replaceAll(" ")
                .trim();
    }
}
