import { motion } from 'framer-motion'
import { FiXCircle } from 'react-icons/fi'

export default function TransferNotFound() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-full max-w-md mx-auto px-6 py-20"
    >
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-stone-100 rounded-full mb-6">
          <FiXCircle size={36} className="text-deep-black" />
        </div>
        <h2 className="font-serif text-3xl md:text-4xl font-medium text-deep-black tracking-tight mb-2">
          Transfer not found.
        </h2>
        <p className="text-stone-500 text-base tracking-wide max-w-lg mx-auto">
          The link you followed may be broken or expired.
        </p>
      </div>
    </motion.div>
  )
}