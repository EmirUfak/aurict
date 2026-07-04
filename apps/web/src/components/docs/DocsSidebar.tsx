"use client"

import { useEffect, useRef, useState } from "react"

type DocsNavItem = {
  anchor: string
  title: string
}

export function DocsSidebar({ items }: { items: DocsNavItem[] }) {
  const [activeAnchor, setActiveAnchor] = useState(items[0]?.anchor ?? "")
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.anchor))
      .filter((section): section is HTMLElement => Boolean(section))

    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]

        if (visible?.target.id) {
          setActiveAnchor(visible.target.id)
        }
      },
      {
        rootMargin: "-22% 0px -58% 0px",
        threshold: [0.08, 0.18, 0.32, 0.5],
      },
    )

    sections.forEach((section) => observer.observe(section))

    return () => observer.disconnect()
  }, [items])

  useEffect(() => {
    const list = listRef.current
    const link = linkRefs.current[activeAnchor]

    if (!list || !link) return

    const isHorizontal = list.scrollWidth > list.clientWidth

    if (isHorizontal) {
      list.scrollTo({
        left: link.offsetLeft - list.clientWidth / 2 + link.clientWidth / 2,
        behavior: "smooth",
      })
      return
    }

    list.scrollTo({
      top: link.offsetTop - list.clientHeight / 2 + link.clientHeight / 2,
      behavior: "smooth",
    })
  }, [activeAnchor])

  return (
    <nav className="docs-sidebar" aria-label="Documentation navigation">
      <div className="docs-sidebar-card">
        <p>On this page</p>
        <div ref={listRef}>
          {items.map((item) => {
            const isActive = activeAnchor === item.anchor

            return (
              <a
                key={item.anchor}
                ref={(node) => {
                  linkRefs.current[item.anchor] = node
                }}
                href={`#${item.anchor}`}
                className="docs-sidebar-link"
                aria-current={isActive ? "true" : undefined}
                onClick={() => setActiveAnchor(item.anchor)}
              >
                {item.title}
              </a>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
