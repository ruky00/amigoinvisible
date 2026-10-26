package com.amigoinvisible.me;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.Clock;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amigoinvisible.common.ApiException;
import com.amigoinvisible.common.Ids;
import com.amigoinvisible.domain.DrawEvent;
import com.amigoinvisible.domain.Participant;
import com.amigoinvisible.domain.ParticipantRepository;
import com.amigoinvisible.domain.Wish;
import com.amigoinvisible.dto.AssignmentDto;
import com.amigoinvisible.dto.Dtos;
import com.amigoinvisible.dto.MeResponse;
import com.amigoinvisible.dto.WishDto;

/**
 * Lo que puede hacer un participante con su código: entrar, ver su sorteo, ver a quién regala
 * y editar su lista. Nunca devuelve nada de otros participantes salvo el nombre y la lista
 * de la persona a la que regala.
 */
@Service
public class MeService {

    static final String UNKNOWN_CODE = "Ese código no nos suena. Revísalo o pídeselo a quien organiza.";
    static final String SESSION_EXPIRED = "Tu sesión ha caducado. Vuelve a entrar con tu código.";
    static final String TEXT_TOO_LONG = "Cada deseo puede tener como mucho 200 letras.";
    static final String TOO_MANY_WISHES = "Como mucho 30 deseos. ¡Deja algo para el año que viene!";
    static final String BAD_URL = "Ese enlace no parece válido. Cópialo entero desde la tienda.";

    static final int MAX_WISHES = 30;

    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private final ParticipantRepository participants;
    private final Clock clock;

    public MeService(ParticipantRepository participants, Clock clock) {
        this.participants = participants;
        this.clock = clock;
    }

    /** "  nieve 42 " → "NIEVE-42": así se puede dictar el código sin preocuparse del formato. */
    static String normalizeCode(String code) {
        if (code == null) {
            return "";
        }
        return WHITESPACE.matcher(code.strip().toUpperCase(Locale.ROOT)).replaceAll("-");
    }

    /** Id del participante con ese código, o 404. */
    @Transactional(readOnly = true)
    public String participantIdForCode(String code) {
        String clean = normalizeCode(code);
        if (clean.isEmpty()) {
            throw ApiException.notFound(UNKNOWN_CODE);
        }
        return participants.findByCode(clean)
                .map(Participant::getId)
                .orElseThrow(() -> ApiException.notFound(UNKNOWN_CODE));
    }

    @Transactional(readOnly = true)
    public MeResponse me(String participantId) {
        Participant p = load(participantId);
        return new MeResponse(Dtos.me(p), Dtos.eventInfo(p.getEvent()));
    }

    /** null mientras no haya sorteo. La primera vez que se enseña, apunta seenAt ("Ha entrado"). */
    @Transactional
    public AssignmentDto assignment(String participantId) {
        Participant p = load(participantId);
        DrawEvent event = p.getEvent();
        if (!event.isDrawn() || p.getReceiverId() == null) {
            return null;
        }
        Participant receiver = participants.findById(p.getReceiverId()).orElse(null);
        if (receiver == null) {
            return null;
        }
        if (p.getSeenAt() == null) {
            p.setSeenAt(clock.instant());
        }
        return new AssignmentDto(receiver.getName(), Dtos.wishes(receiver));
    }

    @Transactional(readOnly = true)
    public List<WishDto> wishlist(String participantId) {
        return Dtos.wishes(load(participantId));
    }

    /**
     * Sustituye la lista entera. Los deseos vacíos se descartan; los que ya existían conservan
     * su id (si de verdad son de esta persona) y los nuevos reciben uno.
     */
    @Transactional
    public List<WishDto> saveWishlist(String participantId, List<WishDto> incoming) {
        Participant p = load(participantId);

        Set<String> ownIds = new HashSet<>();
        p.getWishes().forEach(w -> ownIds.add(w.getId()));

        List<WishDto> clean = new ArrayList<>();
        for (WishDto w : incoming == null ? List.<WishDto>of() : incoming) {
            if (w == null) {
                continue;
            }
            String text = w.text() == null ? "" : w.text().strip();
            if (text.isEmpty()) {
                continue;
            }
            if (text.length() > Wish.TEXT_MAX) {
                throw ApiException.badRequest(TEXT_TOO_LONG);
            }
            clean.add(new WishDto(w.id(), text, cleanUrl(w.url())));
        }
        if (clean.size() > MAX_WISHES) {
            throw ApiException.badRequest(TOO_MANY_WISHES);
        }

        // Primero se borran los deseos antiguos en la base de datos: si no, al reutilizar sus ids
        // Hibernate intentaría insertar los nuevos antes de borrar los viejos (choque de clave).
        p.replaceWishes(List.of());
        participants.flush();

        Set<String> used = new HashSet<>();
        List<Wish> wishes = new ArrayList<>();
        for (WishDto w : clean) {
            // un id ajeno o repetido no se respeta: así nadie toca deseos de otra persona
            String id = w.id() != null && ownIds.contains(w.id()) && used.add(w.id()) ? w.id() : Ids.newId();
            wishes.add(new Wish(id, p, wishes.size(), w.text(), w.url()));
        }
        p.replaceWishes(wishes);
        participants.flush();
        return Dtos.wishes(p);
    }

    /** Vacía → null. Si hay algo, tiene que ser un enlace http(s) completo. */
    private static String cleanUrl(String url) {
        String trimmed = url == null ? "" : url.strip();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > Wish.URL_MAX || !isWebLink(trimmed)) {
            throw ApiException.badRequest(BAD_URL);
        }
        return trimmed;
    }

    private static boolean isWebLink(String url) {
        try {
            URI uri = new URI(url);
            String scheme = uri.getScheme();
            return uri.isAbsolute()
                    && ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))
                    && uri.getHost() != null;
        } catch (URISyntaxException e) {
            return false;
        }
    }

    /** El token puede sobrevivir a su participante (si la organización lo borra): se trata como sesión caducada. */
    private Participant load(String participantId) {
        return participants.findById(participantId).orElseThrow(() -> ApiException.unauthorized(SESSION_EXPIRED));
    }
}
