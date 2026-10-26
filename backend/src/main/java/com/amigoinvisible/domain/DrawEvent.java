package com.amigoinvisible.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.hibernate.annotations.BatchSize;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

/** Un sorteo ("Papá Noel · Familia", "Camisetas raras · Equipo"…) con sus participantes. */
@Entity
@Table(name = "draw_event")
public class DrawEvent {

    public static final int NAME_MAX = 60;
    public static final int BUDGET_MAX = 30;

    @Id
    private String id;

    @Column(nullable = false, length = NAME_MAX)
    private String name;

    @Column(nullable = false, length = BUDGET_MAX)
    private String budget;

    @Column(name = "exchange_date")
    private LocalDate exchangeDate;

    /** Cuándo se hizo el sorteo; null mientras no se ha hecho. */
    @Column(name = "drawn_at")
    private Instant drawnAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /** En el orden en que se apuntaron. */
    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC, id ASC")
    @BatchSize(size = 50)
    private List<Participant> participants = new ArrayList<>();

    protected DrawEvent() {
        // para JPA
    }

    public DrawEvent(String id, String name, String budget, LocalDate exchangeDate, Instant createdAt) {
        this.id = id;
        this.name = name;
        this.budget = budget;
        this.exchangeDate = exchangeDate;
        this.createdAt = createdAt;
    }

    public boolean isDrawn() {
        return drawnAt != null;
    }

    public void addParticipant(Participant participant) {
        participants.add(participant);
    }

    public void removeParticipant(Participant participant) {
        participants.remove(participant);
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getBudget() {
        return budget;
    }

    public void setBudget(String budget) {
        this.budget = budget;
    }

    public LocalDate getExchangeDate() {
        return exchangeDate;
    }

    public void setExchangeDate(LocalDate exchangeDate) {
        this.exchangeDate = exchangeDate;
    }

    public Instant getDrawnAt() {
        return drawnAt;
    }

    public void setDrawnAt(Instant drawnAt) {
        this.drawnAt = drawnAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public List<Participant> getParticipants() {
        return participants;
    }
}
