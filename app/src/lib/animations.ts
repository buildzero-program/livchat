import { type Variants } from "framer-motion";

/**
 * Shared animation variants for page transitions.
 *
 * Usage:
 * ```tsx
 * import { pageVariants } from "~/lib/animations";
 *
 * <motion.div variants={pageVariants.container} initial="hidden" animate="visible">
 *   <motion.div variants={pageVariants.item}>...</motion.div>
 * </motion.div>
 * ```
 */
export const pageVariants = {
  container: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  } satisfies Variants,

  item: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 },
    },
  } satisfies Variants,
};

/**
 * Card animation variants for list items.
 */
export const cardVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
} satisfies Variants;
