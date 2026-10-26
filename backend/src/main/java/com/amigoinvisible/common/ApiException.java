package com.amigoinvisible.common;

import org.springframework.http.HttpStatus;

/**
 * Error que se le enseña tal cual a la persona en el front (por eso el mensaje va en
 * castellano y en tono cercano). Se convierte en {@code {"error": "..."}} con su código HTTP.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }

    public static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message);
    }

    public static ApiException unauthorized(String message) {
        return new ApiException(HttpStatus.UNAUTHORIZED, message);
    }

    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, message);
    }
}
