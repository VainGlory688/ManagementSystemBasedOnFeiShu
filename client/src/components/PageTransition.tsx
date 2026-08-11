import { motion } from 'framer-motion';

const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.3, ease: 'easeOut' }}
    className="h-full"
  >
    {children}
  </motion.div>
);

export default PageTransition;