<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Bot,
  CheckCircle2,
  Clock3,
  Megaphone,
  Send,
  Users,
  Webhook,
} from 'lucide-vue-next'

const props = withDefaults(defineProps<{ compact?: boolean }>(), {
  compact: false,
})

const { t } = useI18n()

const frameClass = computed(() =>
  props.compact ? 'min-h-[410px] p-3 sm:p-4' : 'min-h-[520px] p-4 sm:p-6',
)
</script>

<template>
  <div
    class="relative mx-auto w-full max-w-3xl overflow-hidden rounded-md border bg-background/95 shadow-2xl shadow-primary/10"
    :class="frameClass"
  >
    <div
      class="absolute inset-x-0 top-0 h-16 border-b bg-muted/60"
      aria-hidden="true"
    />
    <div class="relative flex items-center gap-2 pb-8">
      <span class="h-3 w-3 rounded-full bg-red-400" />
      <span class="h-3 w-3 rounded-full bg-amber-400" />
      <span class="h-3 w-3 rounded-full bg-emerald-400" />
      <div class="ml-3 h-7 flex-1 rounded-md border bg-background/80 px-3 text-xs leading-7 text-muted-foreground">
        flux.app/campaigns
      </div>
    </div>

    <div class="relative grid gap-4 md:grid-cols-[1fr_0.78fr] md:items-end">
      <section class="rounded-md border bg-card p-4 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-medium uppercase text-primary">
              {{ t('landing.mockup.badge') }}
            </p>
            <h3 class="mt-1 text-lg font-semibold">{{ t('landing.mockup.title') }}</h3>
            <p class="mt-1 text-sm text-muted-foreground">
              {{ t('landing.mockup.subtitle') }}
            </p>
          </div>
          <span
            class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
          >
            <Bot class="h-5 w-5" />
          </span>
        </div>

        <div class="mt-5 grid gap-3 sm:grid-cols-2">
          <div class="rounded-md border bg-background p-3">
            <div class="flex items-center gap-2 text-sm font-medium">
              <Megaphone class="h-4 w-4 text-amber-500" />
              {{ t('landing.mockup.promoTitle') }}
            </div>
            <p class="mt-2 text-xs text-muted-foreground">
              {{ t('landing.mockup.promoBody') }}
            </p>
          </div>
          <div class="rounded-md border bg-background p-3">
            <div class="flex items-center gap-2 text-sm font-medium">
              <Webhook class="h-4 w-4 text-cyan-500" />
              {{ t('landing.mockup.webhookTitle') }}
            </div>
            <p class="mt-2 text-xs text-muted-foreground">
              {{ t('landing.mockup.webhookBody') }}
            </p>
          </div>
        </div>

        <div class="mt-5 space-y-3">
          <div class="flex items-center gap-3 rounded-md bg-muted/60 p-3">
            <CheckCircle2 class="h-4 w-4 text-emerald-500" />
            <span class="text-sm">{{ t('landing.mockup.approved') }}</span>
          </div>
          <div class="flex items-center gap-3 rounded-md bg-muted/60 p-3">
            <Clock3 class="h-4 w-4 text-amber-500" />
            <span class="text-sm">{{ t('landing.mockup.scheduled') }}</span>
          </div>
          <div class="flex items-center gap-3 rounded-md bg-muted/60 p-3">
            <Users class="h-4 w-4 text-primary" />
            <span class="text-sm">{{ t('landing.mockup.audience') }}</span>
          </div>
        </div>
      </section>

      <section
        class="relative mx-auto flex w-full max-w-[250px] flex-col rounded-[2rem] border bg-foreground p-2 text-background shadow-xl md:translate-y-4"
      >
        <div class="rounded-[1.5rem] bg-background p-3 text-foreground">
          <div class="mx-auto mb-3 h-1 w-14 rounded-full bg-muted-foreground/30" />
          <div class="rounded-md bg-primary px-3 py-2 text-primary-foreground">
            <p class="text-xs font-semibold">{{ t('landing.mockup.groupName') }}</p>
            <p class="text-[11px] opacity-80">{{ t('landing.mockup.members') }}</p>
          </div>

          <div class="mt-4 space-y-3">
            <div class="mr-6 rounded-md bg-muted p-3">
              <p class="text-xs font-medium">{{ t('landing.mockup.messageTitle') }}</p>
              <p class="mt-1 text-[11px] text-muted-foreground">
                {{ t('landing.mockup.messageBody') }}
              </p>
            </div>
            <div class="ml-8 rounded-md bg-primary p-3 text-primary-foreground">
              <p class="text-xs font-medium">{{ t('landing.mockup.botReply') }}</p>
              <div class="mt-2 flex items-center justify-between gap-2 rounded bg-background/15 px-2 py-1">
                <span class="text-[11px]">{{ t('landing.mockup.cta') }}</span>
                <Send class="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
