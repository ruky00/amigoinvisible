package com.amigoinvisible.dto;

/** GET /api/me/assignment. assignment es null si el sorteo no se ha hecho. */
public record AssignmentResponse(AssignmentDto assignment) {
}
