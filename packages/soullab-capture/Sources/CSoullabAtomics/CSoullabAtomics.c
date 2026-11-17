#include "CSoullabAtomics.h"

#include <stdatomic.h>
#include <stdlib.h>

struct sl_atomic_i64 {
    _Atomic(int64_t) value;
};

sl_atomic_i64 *sl_atomic_i64_create(int64_t initial) {
    sl_atomic_i64 *a = malloc(sizeof(sl_atomic_i64));
    if (a == NULL) {
        abort();
    }
    atomic_init(&a->value, initial);
    return a;
}

void sl_atomic_i64_destroy(sl_atomic_i64 *a) {
    free(a);
}

int64_t sl_atomic_i64_load_acquire(const sl_atomic_i64 *a) {
    return atomic_load_explicit((_Atomic(int64_t) *)&a->value, memory_order_acquire);
}

int64_t sl_atomic_i64_load_relaxed(const sl_atomic_i64 *a) {
    return atomic_load_explicit((_Atomic(int64_t) *)&a->value, memory_order_relaxed);
}

void sl_atomic_i64_store_release(sl_atomic_i64 *a, int64_t value) {
    atomic_store_explicit(&a->value, value, memory_order_release);
}

int64_t sl_atomic_i64_fetch_add(sl_atomic_i64 *a, int64_t delta) {
    return atomic_fetch_add_explicit(&a->value, delta, memory_order_acq_rel);
}

int sl_atomic_i64_is_lock_free(void) {
    return ATOMIC_LLONG_LOCK_FREE == 2 ? 1 : 0;
}
