import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ExternalLink, FileText, Hash, MessageCircle, Paperclip, Plus, Search, Send, ShieldCheck, Users2, X } from 'lucide-react'
import { db } from '@/db/schema'
import type { ChatConversation, ChatScope, User } from '@/types/domain'
import type { TenantOutletContext } from '@/layouts/tenant-app-layout'
import { InitialsAvatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const chatIcons: Record<ChatScope, typeof Hash> = { workspace: Hash, team: Users2, project: Hash, direct: MessageCircle, group: Users2, client: ShieldCheck }
const urlPattern = /(https?:\/\/[^\s]+)/g

export function ChatPage() {
  const { org, user } = useOutletContext<TenantOutletContext>()
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [composer, setComposer] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const attachmentInput = useRef<HTMLInputElement>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [mode, setMode] = useState<'direct' | 'group'>('direct')
  const [memberSearch, setMemberSearch] = useState('')
  const [chosen, setChosen] = useState<string[]>([])
  const [groupName, setGroupName] = useState('')
  const members = useLiveQuery(async () => {
    const memberships = await db.orgMembers.where('orgId').equals(org.id).toArray()
    const users = await db.users.bulkGet(memberships.map((member) => member.userId))
    return users.filter((value): value is User => Boolean(value))
  }, [org.id]) ?? []
  const conversations = useLiveQuery(() => db.chatConversations.where('orgId').equals(org.id).toArray(), [org.id]) ?? []
  const reads = useLiveQuery(() => db.chatReadStates.where('userId').equals(user.id).toArray(), [user.id]) ?? []
  const current = conversations.find((conversation) => conversation.id === currentId) ?? conversations[0]
  const messages = useLiveQuery(() => current ? db.chatMessages.where('conversationId').equals(current.id).sortBy('createdAt') : [], [current?.id]) ?? []
  const latestByConversation = useLiveQuery(async () => new Map(await Promise.all(conversations.map(async (conversation) => [conversation.id, await db.chatMessages.where('conversationId').equals(conversation.id).last()] as const))), [conversations.map((conversation) => conversation.id).join('|')]) ?? new Map()
  const readByConversation = new Map(reads.map((read) => [read.conversationId, read.readAt]))
  const normalizedSearch = search.trim().toLowerCase()
  const matches = conversations.filter((conversation) => conversation.name.toLowerCase().includes(normalizedSearch))
  const clientMatches = matches.filter((conversation) => conversation.scope === 'client')
  const internalMatches = matches.filter((conversation) => conversation.scope !== 'client')
  const pickerMembers = members.filter((member) => member.id !== user.id && `${member.name} ${member.title ?? ''}`.toLowerCase().includes(memberSearch.toLowerCase()))

  useEffect(() => {
    if (!current) return
    void db.chatReadStates.put({ id: `${current.id}:${user.id}`, conversationId: current.id, userId: user.id, readAt: new Date().toISOString() })
  }, [current?.id, messages.length, user.id])

  useEffect(() => {
    if (conversations.some((conversation) => conversation.scope === 'client')) return
    void (async () => {
      const project = await db.projects.where('orgId').equals(org.id).first()
      if (!project) return
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      await db.chatConversations.add({ id, orgId: org.id, name: 'Client · Project channel', scope: 'client', participantIds: [project.leadId ?? user.id, 'client:client@example.com'], projectId: project.id, clientName: 'Client', clientEmail: 'client@example.com', createdAt: now })
    })()
  }, [conversations, org.id, user.id])

  function isUnread(conversation: ChatConversation) {
    const latest = latestByConversation.get(conversation.id)
    return Boolean(latest && latest.authorId !== user.id && (!readByConversation.get(conversation.id) || latest.createdAt > readByConversation.get(conversation.id)!))
  }
  async function openDirect(member: User) {
    const existing = conversations.find((conversation) => conversation.scope === 'direct' && conversation.participantIds.includes(user.id) && conversation.participantIds.includes(member.id))
    if (existing) { setCurrentId(existing.id); return }
    const id = crypto.randomUUID()
    await db.chatConversations.add({ id, orgId: org.id, name: member.name, scope: 'direct', participantIds: [user.id, member.id], createdAt: new Date().toISOString() })
    setCurrentId(id)
  }
  async function createConversation() {
    if (mode === 'direct') { const member = members.find((item) => item.id === chosen[0]); if (member) await openDirect(member) }
    else if (groupName.trim() && chosen.length) { const id = crypto.randomUUID(); await db.chatConversations.add({ id, orgId: org.id, name: groupName.trim(), scope: 'group', participantIds: [user.id, ...chosen], createdAt: new Date().toISOString() }); setCurrentId(id) }
    else return
    setNewOpen(false); setChosen([]); setGroupName(''); setMemberSearch('')
  }
  async function send() {
    if (!current || (!composer.trim() && !attachments.length)) return
    await db.chatMessages.add({ id: crypto.randomUUID(), conversationId: current.id, authorId: user.id, authorName: user.name, authorType: 'organization', body: composer.trim(), attachments: attachments.map((file) => ({ id: crypto.randomUUID(), fileName: file.name, size: file.size, mimeType: file.type || 'application/octet-stream' })), createdAt: new Date().toISOString() })
    setComposer(''); setAttachments([])
  }

  return <div className="chat-viber-page">
    <aside className="chat-viber-list">
      <div className="chat-viber-list-header"><div><h1>Messages</h1><p>Internal & client conversations</p></div><button type="button" aria-label="New internal message" onClick={() => setNewOpen(true)}><Plus /></button></div>
      <div className="chat-viber-search"><Search aria-hidden="true" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" /></div>
      <div className="chat-viber-items">
        <ConversationSection title="Client conversations" empty="No client conversations yet." conversations={clientMatches} currentId={current?.id} unread={isUnread} onClick={setCurrentId} />
        <ConversationSection title="Internal conversations" empty="No internal conversations yet." conversations={internalMatches} currentId={current?.id} unread={isUnread} onClick={setCurrentId} />
      </div>
    </aside>
    {current ? <section className="chat-viber-thread">
      <header className="chat-viber-thread-header">{(() => { const Icon = chatIcons[current.scope]; return <><span className={cn('chat-viber-thread-icon', current.scope === 'client' && 'client')}><Icon /></span><span><b>{current.name}</b><small>{current.scope === 'client' ? `Client channel${current.clientEmail ? ` · ${current.clientEmail}` : ''}` : `${current.participantIds.length} participants`}</small></span>{current.scope === 'client' && <span className="chat-viber-private"><ShieldCheck aria-hidden="true" /> Client-visible only</span>}</> })()}</header>
      <div className="chat-viber-messages">{messages.map((message) => { const author = members.find((member) => member.id === message.authorId); const mine = message.authorId === user.id; const authorName = message.authorName ?? author?.name ?? (message.authorType === 'client' ? current.clientName ?? 'Client' : 'Organization member'); return <article key={message.id} className={cn('chat-viber-message', mine && 'chat-viber-message-own')}><InitialsAvatar name={authorName} color={author?.avatarColor ?? (message.authorType === 'client' ? '#7C3AED' : user.avatarColor)} className="size-8" /><div><b>{authorName}{message.authorType === 'client' && <em>Client</em>}</b>{message.body && <p><LinkifiedText text={message.body} /></p>}{message.attachments?.map((attachment) => <span key={attachment.id} className="chat-viber-message-file"><FileText aria-hidden="true" /> {attachment.fileName} <small>{formatSize(attachment.size)}</small></span>)}</div></article> })}</div>
      <form className="chat-viber-composer" onSubmit={(event) => { event.preventDefault(); void send() }}><input ref={attachmentInput} type="file" className="hidden" multiple onChange={(event) => setAttachments(Array.from(event.target.files ?? []))} /><button type="button" aria-label="Attach files" onClick={() => attachmentInput.current?.click()}><Paperclip /></button><Input value={composer} onChange={(event) => setComposer(event.target.value)} placeholder={`Message ${current.scope === 'client' ? current.clientName ?? 'client' : current.name}`} /><Button type="submit" size="icon" aria-label="Send message"><Send /></Button>{attachments.map((file) => <span key={`${file.name}-${file.lastModified}`} className="chat-viber-file">{file.name}<button type="button" onClick={() => setAttachments((all) => all.filter((item) => item !== file))} aria-label={`Remove ${file.name}`}><X /></button></span>)}</form>
    </section> : <section className="chat-viber-empty">Choose a conversation to start chatting.</section>}
    <Dialog open={newOpen} onOpenChange={setNewOpen}><DialogContent className="max-h-[calc(100svh-2rem)] max-w-lg overflow-hidden p-6"><DialogHeader><DialogTitle>New internal message</DialogTitle><DialogDescription>For organization members only. Client conversations are started from the client portal.</DialogDescription></DialogHeader><div className="chat-viber-tabs"><button type="button" className={cn(mode === 'direct' && 'active')} onClick={() => { setMode('direct'); setChosen([]) }}>Direct message</button><button type="button" className={cn(mode === 'group' && 'active')} onClick={() => { setMode('group'); setChosen([]) }}>Group chat</button></div>{mode === 'group' && <Input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Group name" aria-label="Group name" />}<div className="chat-viber-picker-search"><Search aria-hidden="true" /><Input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search members" aria-label="Search members" /></div><div className="chat-viber-picker">{pickerMembers.map((member) => { const checked = chosen.includes(member.id); return <button key={member.id} type="button" onClick={() => setChosen(mode === 'direct' ? [member.id] : checked ? chosen.filter((id) => id !== member.id) : [...chosen, member.id])}><InitialsAvatar name={member.name} color={member.avatarColor} className="size-8" /><span><b>{member.name}</b><small>{member.title ?? 'Member'}</small></span><Checkbox checked={checked} aria-label={`Select ${member.name}`} /></button> })}</div><DialogFooter><Button type="button" variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button><Button type="button" disabled={!chosen.length || (mode === 'group' && !groupName.trim())} onClick={() => void createConversation()}>{mode === 'direct' ? 'Message person' : 'Create group'}</Button></DialogFooter></DialogContent></Dialog>
  </div>
}

function ConversationSection({ title, empty, conversations, currentId, unread, onClick }: { title: string; empty: string; conversations: ChatConversation[]; currentId?: string; unread: (conversation: ChatConversation) => boolean; onClick: (id: string) => void }) {
  return <section className="chat-viber-section"><h2>{title}</h2>{conversations.length ? conversations.map((conversation) => <ConversationRow key={conversation.id} conversation={conversation} active={currentId === conversation.id} unread={unread(conversation)} onClick={() => onClick(conversation.id)} />) : <p className="chat-viber-section-empty">{empty}</p>}</section>
}

function ConversationRow({ conversation, active, unread, onClick }: { conversation: ChatConversation; active: boolean; unread: boolean; onClick: () => void }) { const Icon = chatIcons[conversation.scope]; return <button type="button" onClick={onClick} className={cn('chat-viber-row', active && 'active', unread && 'unread')}><span className={cn('chat-viber-avatar', conversation.scope === 'client' && 'client')}><Icon /></span><span><b>{conversation.name}</b><small>{conversation.scope === 'client' ? 'Client channel' : conversation.scope === 'direct' ? 'Direct message' : `${conversation.participantIds.length} participants`}</small></span>{unread && <span className="chat-viber-unread" aria-label="Unread messages" />}</button> }
function LinkifiedText({ text }: { text: string }) { return <>{text.split(urlPattern).map((part, index) => /^https?:\/\//.test(part) ? <a key={index} href={part} target="_blank" rel="noreferrer">{part}<ExternalLink aria-hidden="true" /></a> : part)}</> }
function formatSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB` }
