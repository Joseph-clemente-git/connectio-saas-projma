import { ExternalLink } from 'lucide-react'

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g
const URL_ONLY_PATTERN = /^https?:\/\/[^\s<]+$/

/** Extracts distinct, http(s) links from user-authored text. */
export function extractLinks(text: string) {
  return [...new Set(text.match(URL_PATTERN) ?? [])]
}

/** Renders plain comment text while turning pasted http(s) URLs into safe links. */
export function LinkifiedText({ text }: { text: string }) {
  return <>{text.split(URL_PATTERN).map((part, index) => URL_ONLY_PATTERN.test(part)
    ? <a key={`${part}-${index}`} href={part} target="_blank" rel="noreferrer" className="break-all text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"><span>{part}</span><ExternalLink aria-hidden="true" className="ml-1 inline size-3 align-text-top" /></a>
    : part,
  )}</>
}
