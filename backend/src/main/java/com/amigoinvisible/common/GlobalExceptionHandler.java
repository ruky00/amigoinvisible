package com.amigoinvisible.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.amigoinvisible.dto.ErrorResponse;

/** Todas las respuestas de error tienen la forma {@code {"error": "mensaje"}}, como espera el front. */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ErrorResponse> handleApi(ApiException e) {
        return error(e.status(), e.getMessage());
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentNotValidException.class})
    ResponseEntity<ErrorResponse> handleBadBody(Exception e) {
        return error(HttpStatus.BAD_REQUEST, "La petición no es válida.");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ErrorResponse> handleNotFound(NoResourceFoundException e) {
        return error(HttpStatus.NOT_FOUND, "Esa dirección no existe.");
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ErrorResponse> handleMethod(HttpRequestMethodNotSupportedException e) {
        return error(HttpStatus.METHOD_NOT_ALLOWED, "Esa operación no está permitida aquí.");
    }

    /** Choque con una restricción de la base de datos (p. ej. dos peticiones a la vez con el mismo nombre). */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ErrorResponse> handleConflict(DataIntegrityViolationException e) {
        log.warn("Violación de integridad: {}", e.getMostSpecificCause().getMessage());
        return error(HttpStatus.CONFLICT, "Ese dato choca con otro que ya existe. Recarga la página y prueba otra vez.");
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
        log.error("Error inesperado", e);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "Algo ha fallado. Prueba otra vez en un momento.");
    }

    private static ResponseEntity<ErrorResponse> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(new ErrorResponse(message));
    }
}
