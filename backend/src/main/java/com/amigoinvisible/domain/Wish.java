package com.amigoinvisible.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Un deseo de la lista: un texto y, si se quiere, un enlace a la tienda. */
@Entity
@Table(name = "wish")
public class Wish {

    public static final int TEXT_MAX = 200;
    public static final int URL_MAX = 2000;

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "participant_id", nullable = false)
    private Participant participant;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "wish_text", nullable = false, length = TEXT_MAX)
    private String text;

    @Column(length = URL_MAX)
    private String url;

    protected Wish() {
        // para JPA
    }

    public Wish(String id, Participant participant, int sortOrder, String text, String url) {
        this.id = id;
        this.participant = participant;
        this.sortOrder = sortOrder;
        this.text = text;
        this.url = url;
    }

    public String getId() {
        return id;
    }

    public Participant getParticipant() {
        return participant;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public String getText() {
        return text;
    }

    public String getUrl() {
        return url;
    }
}
