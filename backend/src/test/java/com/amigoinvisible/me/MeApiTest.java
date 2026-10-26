package com.amigoinvisible.me;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.emptyString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.support.TransactionTemplate;

import com.amigoinvisible.common.Ids;
import com.amigoinvisible.domain.DrawEvent;
import com.amigoinvisible.domain.DrawEventRepository;
import com.amigoinvisible.domain.Participant;
import com.amigoinvisible.domain.ParticipantRepository;
import com.amigoinvisible.domain.Wish;

/** API del participante de punta a punta: datos creados con los repositorios, peticiones con MockMvc. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MeApiTest {

    private static final AtomicInteger SEQ = new AtomicInteger();

    @Autowired
    MockMvc mvc;

    @Autowired
    DrawEventRepository events;

    @Autowired
    ParticipantRepository participants;

    @Autowired
    TransactionTemplate tx;

    private final List<String> createdEvents = new ArrayList<>();

    @AfterEach
    void cleanUp() {
        createdEvents.forEach(events::deleteById);
    }

    // ---------- login ----------

    @Test
    void loginWithExactCodeGivesToken() throws Exception {
        Fixture f = fixture(null);
        mvc.perform(post("/api/login").contentType(MediaType.APPLICATION_JSON).content(codeJson(f.anaCode)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value(not(emptyString())));
    }

    @Test
    void loginNormalisesCode() throws Exception {
        String eventId = Ids.newId();
        tx.executeWithoutResult(s -> {
            DrawEvent e = new DrawEvent(eventId, "Nieve", "", null, Instant.now());
            e.addParticipant(new Participant(Ids.newId(), e, "Nora", "NIEVE-42", Instant.now()));
            events.save(e);
        });
        createdEvents.add(eventId);

        String token = token("  nieve 42 ");
        me(token).andExpect(status().isOk()).andExpect(jsonPath("$.me.name").value("Nora"));
    }

    @Test
    void unknownOrBlankCodeIs404WithMessage() throws Exception {
        for (String code : List.of("NO-EXISTE-999", "   ")) {
            mvc.perform(post("/api/login").contentType(MediaType.APPLICATION_JSON).content(codeJson(code)))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value(MeService.UNKNOWN_CODE));
        }
    }

    // ---------- sesión ----------

    @Test
    void meWithoutOrWithBadTokenIs401() throws Exception {
        mvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value(MeService.SESSION_EXPIRED));
        mvc.perform(get("/api/me").header(HttpHeaders.AUTHORIZATION, "Bearer no-es-un-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value(MeService.SESSION_EXPIRED));
        mvc.perform(get("/api/me/wishlist"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void meReturnsOwnDataAndEventWithFrontShape() throws Exception {
        Fixture f = fixture(null);
        me(token(f.anaCode))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.me.id").value(f.anaId))
                .andExpect(jsonPath("$.me.name").value("Ana"))
                .andExpect(jsonPath("$.me.code").doesNotExist())
                .andExpect(jsonPath("$.me.receiverId").doesNotExist())
                .andExpect(jsonPath("$.event.id").value(f.eventId))
                .andExpect(jsonPath("$.event.name").value("Navidad"))
                .andExpect(jsonPath("$.event.budget").value("20 €"))
                .andExpect(jsonPath("$.event.date").value(""))
                .andExpect(jsonPath("$.event.drawDone").value(false))
                .andExpect(jsonPath("$.event.drawnAt").value((Object) null))
                .andExpect(jsonPath("$.event.participants").doesNotExist());
    }

    @Test
    void meShowsDateWhenSet() throws Exception {
        Fixture f = fixture(LocalDate.of(2026, 12, 24));
        me(token(f.anaCode)).andExpect(jsonPath("$.event.date").value("2026-12-24"));
    }

    // ---------- a quién regalo ----------

    @Test
    void assignmentIsNullBeforeDraw() throws Exception {
        Fixture f = fixture(null);
        // aunque haya receptor apuntado, sin sorteo hecho no se enseña
        tx.executeWithoutResult(s -> participants.findById(f.anaId).orElseThrow().setReceiverId(f.beaId));

        mvc.perform(get("/api/me/assignment").header(HttpHeaders.AUTHORIZATION, bearer(token(f.anaCode))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignment").value((Object) null));
        assertThat(participants.findById(f.anaId).orElseThrow().getSeenAt()).isNull();
    }

    @Test
    void assignmentAfterDrawShowsReceiverAndMarksSeenOnce() throws Exception {
        Fixture f = fixture(null);
        draw(f);
        String token = token(f.anaCode);

        mvc.perform(get("/api/me/assignment").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignment.name").value("Bea"))
                .andExpect(jsonPath("$.assignment.id").doesNotExist())
                .andExpect(jsonPath("$.assignment.wishlist", hasSize(2)))
                .andExpect(jsonPath("$.assignment.wishlist[0].id").value(f.beaWish1))
                .andExpect(jsonPath("$.assignment.wishlist[0].text").value("Calcetines"))
                .andExpect(jsonPath("$.assignment.wishlist[0].url").value("https://tienda.example/calcetines"))
                .andExpect(jsonPath("$.assignment.wishlist[1].text").value("Un libro"))
                .andExpect(jsonPath("$.assignment.wishlist[1].url").value((Object) null));

        Instant firstSeen = participants.findById(f.anaId).orElseThrow().getSeenAt();
        assertThat(firstSeen).isNotNull();
        // Bea no ha mirado nada todavía
        assertThat(participants.findById(f.beaId).orElseThrow().getSeenAt()).isNull();

        mvc.perform(get("/api/me/assignment").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(jsonPath("$.assignment.name").value("Bea"));
        assertThat(participants.findById(f.anaId).orElseThrow().getSeenAt()).isEqualTo(firstSeen);

        me(token).andExpect(jsonPath("$.event.drawDone").value(true))
                .andExpect(jsonPath("$.event.drawnAt").value(not(emptyString())));
    }

    // ---------- mi lista ----------

    @Test
    void ownWishlistOnlyShowsOwnWishes() throws Exception {
        Fixture f = fixture(null);
        wishlist(token(f.anaCode)).andExpect(status().isOk()).andExpect(jsonPath("$.wishes", hasSize(0)));
        wishlist(token(f.beaCode)).andExpect(jsonPath("$.wishes", hasSize(2)));
    }

    @Test
    void saveWishlistKeepsOwnIdsGeneratesNewOnesAndDropsEmpty() throws Exception {
        Fixture f = fixture(null);
        String token = token(f.beaCode);
        String body = """
                {"wishes": [
                  {"id": "", "text": "  Bufanda  ", "url": "  "},
                  {"id": "%s", "text": "Un libro", "url": null},
                  {"id": "", "text": "   ", "url": "https://x.example"},
                  {"id": "%s", "text": "Calcetines rojos", "url": " http://tienda.example/rojos "}
                ]}
                """.formatted(f.beaWish2, f.beaWish1);

        mvc.perform(put("/api/me/wishlist").header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wishes", hasSize(3)))
                .andExpect(jsonPath("$.wishes[0].id").value(not(emptyString())))
                .andExpect(jsonPath("$.wishes[0].text").value("Bufanda"))
                .andExpect(jsonPath("$.wishes[0].url").value((Object) null))
                .andExpect(jsonPath("$.wishes[1].id").value(f.beaWish2))
                .andExpect(jsonPath("$.wishes[2].id").value(f.beaWish1))
                .andExpect(jsonPath("$.wishes[2].text").value("Calcetines rojos"))
                .andExpect(jsonPath("$.wishes[2].url").value("http://tienda.example/rojos"));

        // el orden y los ids se mantienen al volver a leer
        wishlist(token)
                .andExpect(jsonPath("$.wishes[0].text").value("Bufanda"))
                .andExpect(jsonPath("$.wishes[1].id").value(f.beaWish2))
                .andExpect(jsonPath("$.wishes[2].id").value(f.beaWish1));
    }

    @Test
    void saveWishlistIgnoresIdsOfOtherPeople() throws Exception {
        Fixture f = fixture(null);
        String body = """
                {"wishes": [{"id": "%s", "text": "Me lo quedo", "url": null}]}
                """.formatted(f.beaWish1);

        mvc.perform(put("/api/me/wishlist").header(HttpHeaders.AUTHORIZATION, bearer(token(f.anaCode)))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wishes[0].id").value(not(f.beaWish1)));

        // la lista de Bea sigue intacta
        wishlist(token(f.beaCode))
                .andExpect(jsonPath("$.wishes", hasSize(2)))
                .andExpect(jsonPath("$.wishes[0].text").value("Calcetines"));
    }

    @Test
    void saveEmptyOrMissingWishesClearsList() throws Exception {
        Fixture f = fixture(null);
        String token = token(f.beaCode);
        mvc.perform(put("/api/me/wishlist").header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wishes", hasSize(0)));
        wishlist(token).andExpect(jsonPath("$.wishes", hasSize(0)));
    }

    @Test
    void saveWishlistRejectsBadUrls() throws Exception {
        Fixture f = fixture(null);
        String token = token(f.beaCode);
        String longUrl = "https://tienda.example/" + "a".repeat(2000);
        for (String url : List.of("javascript:alert(1)", "tienda.example/calcetines", "ftp://tienda.example/x",
                "https://", "http://con espacios.example", longUrl)) {
            mvc.perform(put("/api/me/wishlist").header(HttpHeaders.AUTHORIZATION, bearer(token))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"wishes\": [{\"id\": \"\", \"text\": \"Algo\", \"url\": \"" + url + "\"}]}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value(MeService.BAD_URL));
        }
        // nada se ha guardado
        wishlist(token).andExpect(jsonPath("$.wishes", hasSize(2)));
    }

    @Test
    void saveWishlistRejectsLongTextAndTooManyWishes() throws Exception {
        Fixture f = fixture(null);
        String token = token(f.anaCode);

        mvc.perform(put("/api/me/wishlist").header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"wishes\": [{\"id\": \"\", \"text\": \"" + "x".repeat(201) + "\", \"url\": null}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(MeService.TEXT_TOO_LONG));

        mvc.perform(put("/api/me/wishlist").header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(wishesJson(31)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(MeService.TOO_MANY_WISHES));

        mvc.perform(put("/api/me/wishlist").header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(wishesJson(30)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wishes", hasSize(30)))
                .andExpect(jsonPath("$.wishes[29].text").value("Deseo 29"));
    }

    @Test
    void deletedParticipantSessionIs401() throws Exception {
        Fixture f = fixture(null);
        String token = token(f.anaCode);
        tx.executeWithoutResult(s -> {
            DrawEvent e = events.findById(f.eventId).orElseThrow();
            e.removeParticipant(participants.findById(f.anaId).orElseThrow());
        });
        // la sesión se borra en cascada en la base de datos, así que también es 401
        me(token).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value(MeService.SESSION_EXPIRED));
    }

    // ---------- utilidades ----------

    /** Sorteo "Navidad" con Ana (sin deseos) y Bea (dos deseos), sin sortear. */
    private Fixture fixture(LocalDate date) {
        int n = SEQ.incrementAndGet();
        String eventId = Ids.newId();
        String anaId = Ids.newId();
        String beaId = Ids.newId();
        String wish1 = Ids.newId();
        String wish2 = Ids.newId();
        String anaCode = "ANA-T" + n;
        String beaCode = "BEA-T" + n;
        tx.executeWithoutResult(s -> {
            Instant now = Instant.now();
            DrawEvent e = new DrawEvent(eventId, "Navidad", "20 €", date, now);
            Participant ana = new Participant(anaId, e, "Ana", anaCode, now);
            Participant bea = new Participant(beaId, e, "Bea", beaCode, now.plusMillis(1));
            bea.replaceWishes(List.of(
                    new Wish(wish1, bea, 0, "Calcetines", "https://tienda.example/calcetines"),
                    new Wish(wish2, bea, 1, "Un libro", null)));
            e.addParticipant(ana);
            e.addParticipant(bea);
            events.save(e);
        });
        createdEvents.add(eventId);
        return new Fixture(eventId, anaId, beaId, anaCode, beaCode, wish1, wish2);
    }

    private void draw(Fixture f) {
        tx.executeWithoutResult(s -> {
            events.findById(f.eventId).orElseThrow().setDrawnAt(Instant.now());
            participants.findById(f.anaId).orElseThrow().setReceiverId(f.beaId);
            participants.findById(f.beaId).orElseThrow().setReceiverId(f.anaId);
        });
    }

    private String token(String code) throws Exception {
        String json = mvc.perform(post("/api/login").contentType(MediaType.APPLICATION_JSON).content(codeJson(code)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        // {"token":"..."}: el token es base64url, sin comillas dentro
        return json.replaceAll("^.*\"token\"\\s*:\\s*\"([^\"]+)\".*$", "$1");
    }

    private ResultActions me(String token) throws Exception {
        return mvc.perform(get("/api/me").header(HttpHeaders.AUTHORIZATION, bearer(token)));
    }

    private ResultActions wishlist(String token) throws Exception {
        return mvc.perform(get("/api/me/wishlist").header(HttpHeaders.AUTHORIZATION, bearer(token)));
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    private static String codeJson(String code) {
        return "{\"code\": \"" + code + "\"}";
    }

    private static String wishesJson(int count) {
        StringBuilder sb = new StringBuilder("{\"wishes\": [");
        for (int i = 0; i < count; i++) {
            sb.append(i == 0 ? "" : ",").append("{\"id\": \"\", \"text\": \"Deseo ").append(i).append("\", \"url\": null}");
        }
        return sb.append("]}").toString();
    }

    private record Fixture(
            String eventId, String anaId, String beaId, String anaCode, String beaCode, String beaWish1, String beaWish2) {
    }
}
