import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listFavoriteRestaurants, addFavoriteRestaurant, removeFavoriteRestaurant } from '../controllers/favorites.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/restaurants', listFavoriteRestaurants);
router.post('/restaurants/:restaurantId', addFavoriteRestaurant);
router.delete('/restaurants/:restaurantId', removeFavoriteRestaurant);

export default router;
