package com.amigoinvisible.dto;

import java.util.List;

/** GET y PUT /api/me/wishlist: {"wishes": [...]} */
public record WishesPayload(List<WishDto> wishes) {
}
