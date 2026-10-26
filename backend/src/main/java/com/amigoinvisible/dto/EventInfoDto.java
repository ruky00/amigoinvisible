package com.amigoinvisible.dto;

/** Datos de un sorteo (EventInfo en el front). date es "YYYY-MM-DD" o ""; drawnAt es ISO-8601 o null. */
public record EventInfoDto(String id, String name, String budget, String date, boolean drawDone, String drawnAt) {
}
