package com.fixlocal.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {

    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred"),
    EXTERNAL_SERVICE_ERROR(HttpStatus.SERVICE_UNAVAILABLE, "Downstream service unavailable"),
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "Invalid input provided"),
    BAD_REQUEST(HttpStatus.BAD_REQUEST, "Bad request"),
    RESOURCE_NOT_FOUND(HttpStatus.NOT_FOUND, "Resource not found"),
    CONFLICT(HttpStatus.CONFLICT, "Conflict occurred"),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "HTTP method not allowed"),
    UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Unsupported media type"),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Authentication required"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "You are not authorized to access this resource"),

    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "User not found"),
    TRADESPERSON_NOT_FOUND(HttpStatus.NOT_FOUND, "Tradesperson not found"),
    SERVICE_OFFERING_NOT_FOUND(HttpStatus.NOT_FOUND, "Service offering not found"),

    INVALID_RATING_RANGE(HttpStatus.BAD_REQUEST, "Rating must be between 1 and 5"),
    TARGET_NOT_TRADESPERSON(HttpStatus.BAD_REQUEST, "Target user is not a tradesperson"),
    CITY_REQUIRED(HttpStatus.BAD_REQUEST, "Location is required in format: City, State, Country"),

    ADMIN_BLOCK_FORBIDDEN(HttpStatus.FORBIDDEN, "Cannot block admin"),
    ADMIN_DELETE_FORBIDDEN(HttpStatus.FORBIDDEN, "Cannot delete admin"),
    TRADESPERSON_ROLE_REQUIRED(HttpStatus.FORBIDDEN, "Only tradespersons can manage service offerings and skill tags");

    private final HttpStatus httpStatus;
    private final String message;

    ErrorCode(HttpStatus httpStatus, String message) {
        this.httpStatus = httpStatus;
        this.message = message;
    }

    public HttpStatus getHttpStatus() {
        return httpStatus;
    }

    public String getMessage() {
        return message;
    }
}
