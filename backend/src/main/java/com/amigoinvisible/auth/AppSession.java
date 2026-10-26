package com.amigoinvisible.auth;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Sesión abierta con un token Bearer: de un participante o de la organización. */
@Entity
@Table(name = "app_session")
public class AppSession {

    @Id
    @Column(length = 64)
    private String token;

    /** null en las sesiones de organización. */
    @Column(name = "participant_id")
    private String participantId;

    @Column(nullable = false)
    private boolean admin;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    protected AppSession() {
        // para JPA
    }

    private AppSession(String token, String participantId, boolean admin, Instant createdAt, Instant expiresAt) {
        this.token = token;
        this.participantId = participantId;
        this.admin = admin;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    static AppSession forParticipant(String token, String participantId, Instant now, Instant expiresAt) {
        return new AppSession(token, participantId, false, now, expiresAt);
    }

    static AppSession forAdmin(String token, Instant now, Instant expiresAt) {
        return new AppSession(token, null, true, now, expiresAt);
    }

    boolean isExpired(Instant now) {
        return !expiresAt.isAfter(now);
    }

    public String getToken() {
        return token;
    }

    public String getParticipantId() {
        return participantId;
    }

    public boolean isAdmin() {
        return admin;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }
}
