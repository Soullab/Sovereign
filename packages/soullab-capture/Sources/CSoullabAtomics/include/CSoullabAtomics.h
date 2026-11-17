#ifndef CSOULLAB_ATOMICS_H
#define CSOULLAB_ATOMICS_H

#include <stdint.h>

/// Opaque lock-free 64-bit atomic counter. Allocated once, off the realtime thread.
typedef struct sl_atomic_i64 sl_atomic_i64;

sl_atomic_i64 *_Nonnull sl_atomic_i64_create(int64_t initial);
void sl_atomic_i64_destroy(sl_atomic_i64 *_Nonnull a);

int64_t sl_atomic_i64_load_acquire(const sl_atomic_i64 *_Nonnull a);
int64_t sl_atomic_i64_load_relaxed(const sl_atomic_i64 *_Nonnull a);
void sl_atomic_i64_store_release(sl_atomic_i64 *_Nonnull a, int64_t value);
int64_t sl_atomic_i64_fetch_add(sl_atomic_i64 *_Nonnull a, int64_t delta);

/// Returns 1 when the platform implementation is lock-free (asserted by tests).
int sl_atomic_i64_is_lock_free(void);

#endif
