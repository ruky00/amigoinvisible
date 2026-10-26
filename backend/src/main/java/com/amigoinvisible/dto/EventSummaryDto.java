package com.amigoinvisible.dto;

/** Resumen de un sorteo para "Mis sorteos" (EventSummary en el front: EventInfo + contadores). */
public record EventSummaryDto(String id, String name, String budget, String date, boolean drawDone, String drawnAt, int participantCount, int wishlistCount, int seenCount) {
}
