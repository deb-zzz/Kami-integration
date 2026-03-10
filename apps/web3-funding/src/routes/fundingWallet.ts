import { Router, type Router as RouterType } from 'express';
import {
  getAllFundingWallets,
  getFundingWalletById,
  createFundingWallet,
  updateFundingWallet,
  patchFundingWallet,
  deleteFundingWallet,
} from '../controllers/fundingWalletController.js';

const router: RouterType = Router();

router.get('/', getAllFundingWallets);
router.get('/:id', getFundingWalletById);
router.post('/', createFundingWallet);
router.put('/:id', updateFundingWallet);
router.patch('/:id', patchFundingWallet);
router.delete('/:id', deleteFundingWallet);

export default router;
