"use client";

import Link from "next/link";
import { useState } from "react";

const PUBLIC_NAV = [
  { href: "/", label: "Hem" },
  { href: "/deals", label: "Erbjudanden" },
  { href: "/recipes", label: "Recept" },
];

const ADMIN_NAV = [
  { href: "/upload", label: "Ladda upp" },
];

export default function Header({ isAdmin = false }: { isAdmin?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = isAdmin
    ? [...PUBLIC_NAV, ...ADMIN_NAV]
    : PUBLIC_NAV;

  async function handleLogout() {
    await fetch("/api/admin", { method: "DELETE" });
    window.location.href = "/";
  }

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-gray-900">
          Matkrig
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              {item.label}
            </Link>
          ))}
          {isAdmin ? (
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-gray-600 ml-2"
            >
              Logga ut
            </button>
          ) : (
            <Link
              href="/admin"
              className="text-xs text-gray-400 hover:text-gray-600 ml-2"
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-gray-600"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Meny"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {menuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="md:hidden border-t border-gray-200 bg-white">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-4 py-3 text-sm text-gray-600 hover:bg-gray-50"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          {isAdmin ? (
            <button
              onClick={() => {
                setMenuOpen(false);
                handleLogout();
              }}
              className="block w-full text-left px-4 py-3 text-sm text-gray-400 hover:bg-gray-50"
            >
              Logga ut admin
            </button>
          ) : (
            <Link
              href="/admin"
              className="block px-4 py-3 text-sm text-gray-400 hover:bg-gray-50"
              onClick={() => setMenuOpen(false)}
            >
              Admin
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
