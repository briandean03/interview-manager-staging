import { motion } from "framer-motion"

export default function HoverCard({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      whileHover={{
        y: -4,
        scale: 1.02,
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
      }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={`rounded-xl bg-white border border-gray-200 p-4 ${className}`}
    >
      {children}
    </motion.div>
  )
}
