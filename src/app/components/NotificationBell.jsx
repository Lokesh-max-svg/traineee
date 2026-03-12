'use client';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Check, User, Clock, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../api/client';

const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingIds, setProcessingIds] = useState(new Set());
  const dropdownRef = useRef(null);

  // Fetch pending requests
  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/trainer-app/gym-requests');

      if (res.ok) {
        const data = await res.json();
        setRequests(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch gym requests:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and when dropdown opens
  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchRequests();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Accept request
  const handleAccept = async (odid) => {
    setProcessingIds((prev) => new Set([...prev, odid]));

    try {
      const res = await apiFetch(`/trainer-app/gym-requests/${odid}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        toast.success('Request accepted successfully');
        setRequests((prev) => prev.filter((r) => r.odid !== odid));
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to accept request');
      }
    } catch (error) {
      console.error('Error accepting request:', error);
      toast.error('Failed to accept request');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(odid);
        return next;
      });
    }
  };

  // Reject request
  const handleReject = async (odid) => {
    setProcessingIds((prev) => new Set([...prev, odid]));

    try {
      const res = await apiFetch(`/trainer-app/gym-requests/${odid}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        toast.success('Request rejected');
        setRequests((prev) => prev.filter((r) => r.odid !== odid));
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to reject request');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Failed to reject request');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(odid);
        return next;
      });
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingCount = requests.length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
      >
        <Bell className="w-5 h-5" />
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden z-50"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold">Gym Join Requests</h3>
                <p className="text-emerald-100 text-sm">
                  {pendingCount} pending {pendingCount === 1 ? 'request' : 'requests'}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-3 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
                </div>
              ) : requests.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No pending requests</p>
                  <p className="text-gray-400 text-sm mt-1">New requests will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {requests.map((request) => (
                    <RequestCard
                      key={request.odid}
                      request={request}
                      onAccept={() => handleAccept(request.odid)}
                      onReject={() => handleReject(request.odid)}
                      isProcessing={processingIds.has(request.odid)}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Request Card Component
const RequestCard = ({ request, onAccept, onReject, isProcessing, formatDate }) => {
  const [showProof, setShowProof] = useState(false);

  return (
    <div className="p-4 hover:bg-gray-50 transition">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-semibold text-lg shrink-0">
          {request.photoURL ? (
            <img
              src={request.photoURL}
              alt={request.displayName}
              className="w-full h-full rounded-xl object-cover"
            />
          ) : (
            request.displayName?.[0]?.toUpperCase() || <User className="w-6 h-6" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900 truncate">{request.displayName}</h4>
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
              {request.gymExpertise}
            </span>
          </div>

          <p className="text-sm text-gray-500 truncate">{request.email}</p>

          <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(request.requestedAt)}
            </span>
            {request.heightInCm && request.weightInKg && (
              <span>
                {request.heightInCm}cm / {request.weightInKg}kg
              </span>
            )}
          </div>

          {request.hasHealthIssues && request.healthIssuesDescription && (
            <p className="mt-1 text-xs text-red-500 bg-red-50 px-2 py-1 rounded">
              Health: {request.healthIssuesDescription}
            </p>
          )}

          {/* Proof Image Toggle */}
          {request.proofImageUrl && (
            <button
              onClick={() => setShowProof(!showProof)}
              className="mt-2 flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700"
            >
              <ImageIcon className="w-3 h-3" />
              {showProof ? 'Hide proof' : 'View proof image'}
              <ChevronRight className={`w-3 h-3 transition-transform ${showProof ? 'rotate-90' : ''}`} />
            </button>
          )}

          {/* Proof Image */}
          <AnimatePresence>
            {showProof && request.proofImageUrl && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-2 overflow-hidden"
              >
                <img
                  src={request.proofImageUrl}
                  alt="Gym membership proof"
                  className="w-full h-32 object-cover rounded-lg border border-gray-200"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 mt-3 ml-15">
        <button
          onClick={onReject}
          disabled={isProcessing}
          className="flex-1 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            </span>
          ) : (
            <span className="flex items-center justify-center gap-1">
              <X className="w-4 h-4" />
              Reject
            </span>
          )}
        </button>
        <button
          onClick={onAccept}
          disabled={isProcessing}
          className="flex-1 px-3 py-2 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/30"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </span>
          ) : (
            <span className="flex items-center justify-center gap-1">
              <Check className="w-4 h-4" />
              Accept
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

export default NotificationBell;
