package com.amigoinvisible.dto;

import java.util.List;

/** La persona a la que regala y su lista. */
public record AssignmentDto(String name, List<WishDto> wishlist) {
}
