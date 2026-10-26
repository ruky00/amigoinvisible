package com.amigoinvisible.dto;

/** Crear o editar un sorteo. budget y date pueden ir vacíos. */
public record EventDraftRequest(String name, String budget, String date) {
}
