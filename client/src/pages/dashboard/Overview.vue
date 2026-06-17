<script setup lang="ts">
import { User } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardDescription from '@/components/ui/CardDescription.vue'
import CardContent from '@/components/ui/CardContent.vue'

const auth = useAuthStore()
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Visão geral</h1>
      <p class="text-sm text-muted-foreground">Bem-vindo de volta, {{ auth.user?.username }}.</p>
    </div>
    <Card class="max-w-md">
      <CardHeader>
        <CardTitle class="flex items-center gap-2 text-base">
          <User class="h-4 w-4" /> Conta
        </CardTitle>
        <CardDescription>Usuário autenticado (JWT via cookie)</CardDescription>
      </CardHeader>
      <CardContent class="space-y-1 text-sm">
        <p><span class="text-muted-foreground">ID:</span> {{ auth.user?.id }}</p>
        <p><span class="text-muted-foreground">Usuário:</span> {{ auth.user?.username }}</p>
        <p><span class="text-muted-foreground">Email:</span> {{ auth.user?.email }}</p>
      </CardContent>
    </Card>
  </div>
</template>
