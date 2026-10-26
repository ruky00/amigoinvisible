package com.amigoinvisible.me;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.amigoinvisible.auth.AuthenticatedParticipant;
import com.amigoinvisible.dto.AssignmentResponse;
import com.amigoinvisible.dto.MeResponse;
import com.amigoinvisible.dto.WishesPayload;

/** Rutas del participante con sesión. El parámetro AuthenticatedParticipant ya exige token (o 401). */
@RestController
@RequestMapping("/api/me")
public class MeController {

    private final MeService me;

    public MeController(MeService me) {
        this.me = me;
    }

    @GetMapping
    MeResponse me(AuthenticatedParticipant who) {
        return me.me(who.participantId());
    }

    @GetMapping("/assignment")
    AssignmentResponse assignment(AuthenticatedParticipant who) {
        return new AssignmentResponse(me.assignment(who.participantId()));
    }

    @GetMapping("/wishlist")
    WishesPayload wishlist(AuthenticatedParticipant who) {
        return new WishesPayload(me.wishlist(who.participantId()));
    }

    @PutMapping("/wishlist")
    WishesPayload saveWishlist(AuthenticatedParticipant who, @RequestBody(required = false) WishesPayload body) {
        return new WishesPayload(me.saveWishlist(who.participantId(), body == null ? null : body.wishes()));
    }
}
