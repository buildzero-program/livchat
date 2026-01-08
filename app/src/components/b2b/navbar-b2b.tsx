"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, User } from "lucide-react";

import { APP_NAME } from "~/lib/constants";

const NAV_LINKS = [
  { label: "Solucao", href: "#solucao" },
  { label: "Funcionalidades", href: "#funcionalidades" },
  { label: "Como Funciona", href: "#como-funciona" },
  { label: "FAQ", href: "#faq" },
];

export function NavbarB2B() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* Fixed container */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <motion.nav
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={`
            mx-auto mt-2 px-6 transition-all duration-300 lg:px-12
            ${isScrolled
              ? "max-w-5xl rounded-2xl border border-white/[0.08] bg-[#171717]/50 backdrop-blur-xl"
              : "max-w-7xl"
            }
          `}
        >
          <div className={`
            flex items-center justify-between
            transition-all duration-300
            ${isScrolled ? "py-2.5" : "py-4"}
          `}>
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              {/* Logo Icon - using light variant for dark backgrounds */}
              <svg width="26" height="26" viewBox="0 0 353 359" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M73.7725 0.187012C89.2514 -0.180985 105.992 0.10791 121.569 0.10791L210.468 0.103027L255.352 0.10498C266.154 0.113971 280.436 -0.252666 290.759 1.63525C303.392 3.95824 315.188 9.57171 324.958 17.9097C357.012 45.1726 351.683 78.3086 351.692 115.87L351.718 202.205L351.757 261.396C351.781 276.671 353.15 292.944 348.114 307.484C337.16 339.106 311.347 356.484 278.679 358.791C263.765 359.205 247.251 358.866 232.238 358.864L143.788 358.847L98.2852 358.854C70.1104 358.87 48.8557 359.978 25.9248 340.026C11.0578 327 1.93876 308.629 0.551758 288.912C-0.410218 275.163 0.176477 256.595 0.188477 242.445L0.295898 157.315L0.282227 98.9829C0.280227 88.482 -0.498833 74.425 1.24512 64.354C7.76412 26.717 36.5115 2.60401 73.7725 0.187012ZM257.722 23.8989C215.426 24.4079 173.002 23.3687 130.754 24.0327C119.868 23.7477 108.839 24.036 98.0703 23.939C77.1633 23.576 57.7707 22.8523 41.5957 38.4663C28.7601 50.8571 24.0143 65.2768 23.9902 82.8354C23.9322 125.605 24.0651 168.245 24.0361 211.004C24.0331 215.373 23.9002 219.957 24.0752 224.287L23.9912 259.466C23.9432 281.576 22.4253 300.477 39.3379 317.747C47.5299 326.111 61.8966 333.103 73.6416 333.522C77.1583 334.329 90.2728 334.098 94.4756 334.082L129.604 334.022C176.903 334.017 224.254 334.056 271.553 333.942C287.406 333.904 301.954 329.008 313.149 317.339C319.269 310.948 323.579 303.044 325.635 294.438C327.668 286.08 327.501 277.21 327.422 268.648C327.2 244.584 327.786 220.413 327.318 196.361C327.761 184.42 327.37 169.833 327.374 157.721L327.343 88.1606C327.424 85.9028 327.467 83.645 327.472 81.3862C327.422 64.8122 323.197 51.4595 311.321 39.7085C295.687 24.2296 278.264 23.6519 257.722 23.8989Z" fill="url(#nav_paint0_linear)"/>
                <path d="M195.627 58.289C198.026 56.42 201.094 55.6332 204.097 56.1161C217.289 58.3601 208.784 77.7111 206.613 85.6981L197.658 118.712C196.048 124.638 193.828 132.02 192.641 137.919C191.206 142.559 189.488 151.022 189.244 152.511C189 154 191.811 154.673 192.722 154.869C199.859 156.397 210.538 155.099 217.882 154.731C221.527 153.987 235.013 153.859 239.085 153.834C253.134 152.346 259.189 161.052 251.289 173.078C245.075 182.539 238.519 191.557 231.928 200.752L200.599 244.73L179.674 274.233C174.889 281.079 170.32 288.144 164.779 294.399C160.942 298.73 155.229 299.791 150.971 295.357C148.898 293.165 147.78 290.24 147.86 287.226C147.946 284.328 153.362 266.245 154.444 262.438C159.145 245.931 163.712 229.385 168.142 212.804C168.674 210.448 171.919 200.598 167.149 200.673C153.938 200.882 140.443 203.268 127.163 203.875C121.756 204.135 113.803 205.123 108.889 202.223C96.3972 194.853 110.127 180.213 114.395 173.041L114.668 172.576C117.25 169.682 121.4 163.247 123.721 159.902L136.459 141.849C150.266 121.717 164.209 101.677 178.286 81.7323C182.172 76.1542 191.008 61.8381 195.627 58.289Z" fill="url(#nav_paint1_linear)"/>
                <defs>
                  <linearGradient id="nav_paint0_linear" x1="333.989" y1="329.811" x2="17.5745" y2="28.8755" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#B6B1FE"/>
                    <stop offset="1" stopColor="#FFD4FF"/>
                  </linearGradient>
                  <linearGradient id="nav_paint1_linear" x1="211.828" y1="185.981" x2="140.529" y2="111.592" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#C975FF"/>
                    <stop offset="1" stopColor="#FFE3FF"/>
                  </linearGradient>
                </defs>
              </svg>
              <span className="font-[family-name:var(--font-display)] text-base font-semibold text-white">
                {APP_NAME}
              </span>
            </Link>

            {/* Desktop Navigation - Simple Links */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="px-4 py-2 text-sm font-[family-name:var(--font-body)] text-[#a6a6a6] hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right Side - Login + CTA */}
            <div className="hidden md:flex items-center gap-3">
              {/* Login */}
              <Link
                href="https://app.livchat.ai/"
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-[family-name:var(--font-body)] text-[#a6a6a6] hover:text-white transition-colors border border-white/[0.1] rounded-xl hover:border-white/20"
              >
                <User className="h-4 w-4" />
                Login
              </Link>

              {/* CTA Button */}
              <Link href="https://wa.me/5511948182061?text=Oi!%20Quero%20entender%20como%20a%20LivChat%20pode%20ajudar%20minha%20ag%C3%AAncia%20a%20converter%20mais%20leads.">
                <button className="h-10 px-4 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-400 rounded-xl transition-colors">
                  Comecar Agora!
                </button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-[#a6a6a6] hover:text-white transition-colors"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </motion.nav>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-4 top-20 z-40 md:hidden bg-[#171717]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-xl"
          >
            <div className="px-6 py-6 space-y-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block py-3 text-base font-[family-name:var(--font-body)] text-[#a6a6a6] hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-4 mt-4 border-t border-white/[0.06] space-y-3">
                <Link href="https://app.livchat.ai/" className="block">
                  <button className="w-full flex items-center justify-center gap-2 h-11 text-sm font-medium text-white border border-white/[0.1] rounded-xl hover:border-white/20 transition-colors">
                    <User className="h-4 w-4" />
                    Login
                  </button>
                </Link>
                <Link href="https://wa.me/5511948182061?text=Oi!%20Quero%20entender%20como%20a%20LivChat%20pode%20ajudar%20minha%20ag%C3%AAncia%20a%20converter%20mais%20leads." className="block">
                  <button className="w-full h-11 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-400 rounded-xl transition-colors">
                    Comecar Agora!
                  </button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
