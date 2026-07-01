const service = require('./claims.service');

const createClaim    = async (req, res, next) => { try { res.status(201).json(await service.createClaim(req.user.id, req.body)); } catch(e){next(e)} };
const editDraftClaim = async (req, res, next) => { try { res.json(await service.editDraftClaim(req.params.id, req.user.id, req.body)); } catch(e){next(e)} };
const addItem        = async (req, res, next) => { try { res.status(201).json(await service.addItem(req.params.id, req.user.id, req.body)); } catch(e){next(e)} };
const removeItem     = async (req, res, next) => { try { res.json(await service.removeItem(req.params.itemId, req.params.id, req.user.id)); } catch(e){next(e)} };
const clearItems     = async (req, res, next) => { try { res.json(await service.clearItems(req.params.id, req.user.id)); } catch(e){next(e)} };
const submitClaim    = async (req, res, next) => { try { res.json(await service.submitClaim(req.params.id, req.user.id)); } catch(e){next(e)} };
const myClaims       = async (req, res, next) => { try { res.json(await service.getMyClaims(req.user.id)); } catch(e){next(e)} };
const getClaimById   = async (req, res, next) => { try { res.json(await service.getClaimById(req.params.id, req.user.id, req.user.role)); } catch(e){next(e)} };
const pendingForSric = async (req, res, next) => { try { res.json(await service.getPendingForSric()); } catch(e){next(e)} };
const decidedForSric = async (req, res, next) => { try { res.json(await service.getDecidedBySric()); } catch(e){next(e)} };
const pendingForDean = async (req, res, next) => { try { res.json(await service.getPendingForDean()); } catch(e){next(e)} };
const decidedClaims  = async (req, res, next) => { try { res.json(await service.getDecidedByDean()); } catch(e){next(e)} };
const getAllClaims   = async (req, res, next) => { try { res.json(await service.getAllClaims(req.query.search)); } catch(e){next(e)} };
const getFacultyProfile = async (req, res, next) => { try { res.json(await service.getFacultyProfile(req.params.facultyId)); } catch(e){next(e)} };
const deleteDraft    = async (req, res, next) => { try { res.json(await service.deleteDraft(req.params.id, req.user.id)); } catch(e){next(e)} };

module.exports = {
  createClaim, editDraftClaim, addItem, removeItem, clearItems, submitClaim,
  myClaims, getClaimById, pendingForSric, decidedForSric, pendingForDean,
  decidedClaims, getAllClaims, getFacultyProfile, deleteDraft
};