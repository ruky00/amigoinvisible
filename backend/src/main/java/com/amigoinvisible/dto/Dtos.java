package com.amigoinvisible.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.amigoinvisible.domain.DrawEvent;
import com.amigoinvisible.domain.Participant;
import com.amigoinvisible.domain.Wish;

/**
 * Conversión de entidades a los DTO que espera el front (ver src/types.ts del front).
 * Es el único sitio donde se decide el formato de fechas y nulos de la API.
 */
public final class Dtos {

    private Dtos() {
    }

    public static EventInfoDto eventInfo(DrawEvent e) {
        return new EventInfoDto(
                e.getId(), e.getName(), e.getBudget(), date(e.getExchangeDate()), e.isDrawn(), instant(e.getDrawnAt()));
    }

    public static EventSummaryDto eventSummary(DrawEvent e) {
        List<Participant> people = e.getParticipants();
        int withList = (int) people.stream().filter(p -> !p.getWishes().isEmpty()).count();
        int seen = (int) people.stream().filter(p -> p.getSeenAt() != null).count();
        return new EventSummaryDto(
                e.getId(), e.getName(), e.getBudget(), date(e.getExchangeDate()), e.isDrawn(), instant(e.getDrawnAt()),
                people.size(), withList, seen);
    }

    public static AdminStateDto adminState(DrawEvent e) {
        return new AdminStateDto(eventInfo(e), e.getParticipants().stream().map(Dtos::adminParticipant).toList());
    }

    public static AdminParticipantDto adminParticipant(Participant p) {
        return new AdminParticipantDto(
                p.getId(), p.getName(), p.getCode(), List.copyOf(p.getExclusionIds()), p.getWishes().size(),
                instant(p.getSeenAt()));
    }

    public static MeDto me(Participant p) {
        return new MeDto(p.getId(), p.getName());
    }

    public static WishDto wish(Wish w) {
        return new WishDto(w.getId(), w.getText(), w.getUrl());
    }

    public static List<WishDto> wishes(Participant p) {
        return p.getWishes().stream().map(Dtos::wish).toList();
    }

    /** "YYYY-MM-DD" o "" si no hay fecha. */
    public static String date(LocalDate date) {
        return date == null ? "" : date.toString();
    }

    /** ISO-8601 en UTC o null. */
    public static String instant(Instant instant) {
        return instant == null ? null : instant.toString();
    }
}
