package com.amigoinvisible.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.hibernate.annotations.BatchSize;

import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

/**
 * Una persona dentro de UN sorteo. Quien está en dos sorteos es dos participantes,
 * cada uno con su propio código.
 */
@Entity
@Table(name = "participant")
public class Participant {

    public static final int NAME_MAX = 40;

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_id", nullable = false)
    private DrawEvent event;

    @Column(nullable = false, length = NAME_MAX)
    private String name;

    /** Código para entrar ("NIEVE-42"). Único en toda la base de datos. */
    @Column(nullable = false, unique = true, length = 20)
    private String code;

    /** Id del participante al que regala; null hasta que se hace el sorteo. Es secreto. */
    @Column(name = "receiver_id")
    private String receiverId;

    /** Cuándo vio por primera vez a su amigo invisible. */
    @Column(name = "seen_at")
    private Instant seenAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /** Ids de participantes (del mismo sorteo) a los que no le puede tocar regalar. */
    @ElementCollection
    @BatchSize(size = 50)
    @CollectionTable(name = "participant_exclusion", joinColumns = @JoinColumn(name = "participant_id"))
    @Column(name = "excluded_id", nullable = false)
    private Set<String> exclusionIds = new LinkedHashSet<>();

    @OneToMany(mappedBy = "participant", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    @BatchSize(size = 50)
    private List<Wish> wishes = new ArrayList<>();

    protected Participant() {
        // para JPA
    }

    public Participant(String id, DrawEvent event, String name, String code, Instant createdAt) {
        this.id = id;
        this.event = event;
        this.name = name;
        this.code = code;
        this.createdAt = createdAt;
    }

    /** Sustituye la lista de deseos entera, respetando el orden recibido. */
    public void replaceWishes(List<Wish> newWishes) {
        wishes.clear();
        wishes.addAll(newWishes);
    }

    public String getId() {
        return id;
    }

    public DrawEvent getEvent() {
        return event;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCode() {
        return code;
    }

    public String getReceiverId() {
        return receiverId;
    }

    public void setReceiverId(String receiverId) {
        this.receiverId = receiverId;
    }

    public Instant getSeenAt() {
        return seenAt;
    }

    public void setSeenAt(Instant seenAt) {
        this.seenAt = seenAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Set<String> getExclusionIds() {
        return exclusionIds;
    }

    public List<Wish> getWishes() {
        return wishes;
    }
}
