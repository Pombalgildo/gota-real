'use client'

import { useState } from 'react'
import { useAppStore, formatDateTime } from '@/store/app-store'
import { useFeedback } from '@/components/app/hooks'
import { createFeedback } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { Feedback } from '@/lib/types'
import {
  Lightbulb,
  Loader2,
  MessageSquareHeart,
  MessageSquareWarning,
  Reply,
  Send,
} from 'lucide-react'

export function FeedbackView() {
  const { customer } = useAppStore()
  const { feedbacks, loading, reload } = useFeedback(customer?.id)
  const { toast } = useToast()

  const [type, setType] = useState<'sugestao' | 'reclamacao'>('sugestao')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function submit() {
    if (!subject.trim() || !message.trim()) {
      toast({
        title: 'Campos incompletos',
        description: 'Preencha o assunto e a mensagem.',
        variant: 'destructive',
      })
      return
    }
    setSending(true)
    try {
      await createFeedback({
        customerId: customer?.id,
        type,
        subject: subject.trim(),
        message: message.trim(),
      })
      setSubject('')
      setMessage('')
      reload()
      toast({
        title: type === 'sugestao' ? 'Sugestão enviada! 💡' : 'Reclamação registada 📝',
        description: 'A central recebeu a sua mensagem e vai responder aqui.',
      })
    } catch (err) {
      toast({
        title: 'Erro ao enviar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <h2 className="text-base font-black text-navy">Sugestões e reclamações</h2>

      {/* formulário */}
      <div className="space-y-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType('sugestao')}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xl border-2 p-3 text-sm font-bold transition-all',
              type === 'sugestao'
                ? 'border-primary bg-secondary/70 text-navy shadow-sm'
                : 'border-border bg-white text-muted-foreground hover:border-input'
            )}
          >
            <Lightbulb className="h-4 w-4" /> Sugestão
          </button>
          <button
            type="button"
            onClick={() => setType('reclamacao')}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xl border-2 p-3 text-sm font-bold transition-all',
              type === 'reclamacao'
                ? 'border-red-400 bg-red-50 text-red-700 shadow-sm'
                : 'border-border bg-white text-muted-foreground hover:border-input'
            )}
          >
            <MessageSquareWarning className="h-4 w-4" /> Reclamação
          </button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fb-subject">Assunto</Label>
          <Input
            id="fb-subject"
            placeholder="Ex.: entrega rápida; qualidade do bidão; atendimento…"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fb-message">A sua mensagem</Label>
          <Textarea
            id="fb-message"
            placeholder="Escreva aqui a sua sugestão ou reclamação. A nossa central lê todas as mensagens."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-24"
          />
        </div>
        <Button onClick={submit} disabled={sending} className="h-11 w-full font-bold">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar {type === 'sugestao' ? 'sugestão' : 'reclamação'}
        </Button>
      </div>

      {/* histórico */}
      <section aria-labelledby="fb-history" className="space-y-2.5">
        <h3 id="fb-history" className="text-sm font-black text-navy">
          As minhas mensagens
        </h3>
        {loading ? (
          <p className="text-xs text-muted-foreground">a carregar…</p>
        ) : feedbacks.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-input bg-white/60 py-10 text-muted-foreground">
            <MessageSquareHeart className="h-8 w-8 opacity-40" />
            <p className="mt-2 text-xs font-medium">Ainda não enviou mensagens</p>
          </div>
        ) : (
          feedbacks.map((f) => <FeedbackCard key={f.id} feedback={f} />)
        )}
      </section>
    </div>
  )
}

function FeedbackCard({ feedback }: { feedback: Feedback }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              feedback.type === 'sugestao'
                ? 'bg-secondary text-primary'
                : 'bg-red-100 text-red-600'
            )}
          >
            {feedback.type === 'sugestao' ? (
              <Lightbulb className="h-4 w-4" />
            ) : (
              <MessageSquareWarning className="h-4 w-4" />
            )}
          </span>
          <div>
            <p className="text-sm font-bold leading-tight text-navy">{feedback.subject}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatDateTime(feedback.createdAt)}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-[10px] font-bold',
            feedback.status === 'respondido'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          )}
        >
          {feedback.status === 'respondido' ? 'respondido' : 'em aberto'}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-foreground">{feedback.message}</p>
      {feedback.response && (
        <div className="mt-2.5 rounded-xl bg-secondary/70 p-3">
          <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-secondary-foreground">
            <Reply className="h-3 w-3" /> resposta da central
          </p>
          <p className="mt-1 text-xs leading-relaxed text-foreground">{feedback.response}</p>
        </div>
      )}
    </div>
  )
}
