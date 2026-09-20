import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { RepairTicket, RepairStatus, Customer, User } from '../../types';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { JalaliDatePicker } from '../ui/JalaliDatePicker';
import { VoiceInputButton } from '../ui/VoiceInputButton';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { Wrench, Check, ShieldCheck, DollarSign } from 'lucide-react';
import { formatToman } from '../../lib/currencyUtils';
import { useTranslation } from '../../lib/i18n';

export interface RepairFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketToEdit?: RepairTicket | null;
  initialCustomer?: Customer | null;
  allCustomers: Customer[];
  allUsers: User[];
  onSaved: (ticket: RepairTicket) => void;
}

export const RepairFormModal: React.FC<RepairFormModalProps> = ({
  isOpen,
  onClose,
  ticketToEdit,
  initialCustomer,
  allCustomers = [],
  allUsers = [],
  onSaved,
}) => {
  const { success, error } = useToast();
  const { t, isRtl, formatCurrency } = useTranslation();

  const [ticketNumber, setTicketNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [imei, setImei] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [technicianNotes, setTechnicianNotes] = useState('');
  const [status, setStatus] = useState<RepairStatus>(RepairStatus.RECEIVED);
  const [estimatedCost, setEstimatedCost] = useState('');
  const [finalCost, setFinalCost] = useState('');
  const [assignedTechnicianId, setAssignedTechnicianId] = useState('');
  const [warrantyUntil, setWarrantyUntil] = useState('');

  useEffect(() => {
    if (ticketToEdit) {
      setTicketNumber(ticketToEdit.ticketNumber || '');
      setCustomerId(ticketToEdit.customerId || '');
      setDeviceModel(ticketToEdit.deviceModel || '');
      setImei(ticketToEdit.imei || '');
      setSerialNumber(ticketToEdit.serialNumber || '');
      setProblemDescription(ticketToEdit.problemDescription || '');
      setTechnicianNotes(ticketToEdit.technicianNotes || '');
      setStatus(ticketToEdit.status || RepairStatus.RECEIVED);
      setEstimatedCost(String(ticketToEdit.estimatedCost || ''));
      setFinalCost(String(ticketToEdit.finalCost || ''));
      setAssignedTechnicianId(ticketToEdit.assignedTechnicianId || '');
      setWarrantyUntil(ticketToEdit.warrantyUntil ? ticketToEdit.warrantyUntil.substring(0, 10) : '');
    } else {
      const now = new Date();
      setTicketNumber(`REP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`);
      setCustomerId(initialCustomer?.id || (allCustomers[0]?.id || ''));
      setDeviceModel('');
      setImei('');
      setSerialNumber('');
      setProblemDescription('');
      setTechnicianNotes('');
      setStatus(RepairStatus.RECEIVED);
      setEstimatedCost('');
      setFinalCost('');
      const currentUser = storage.getCurrentUser();
      setAssignedTechnicianId(currentUser.id);
      setWarrantyUntil('');
    }
  }, [ticketToEdit, initialCustomer, allCustomers, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceModel.trim()) {
      error(isRtl ? 'لطفاً مدل دستگاه را وارد کنید' : 'Please enter the device model');
      return;
    }
    if (!problemDescription.trim()) {
      error(isRtl ? 'لطفاً شرح ایراد یا عیب اعلامی مشتری را وارد کنید' : 'Please enter problem description');
      return;
    }
    if (!customerId) {
      error(isRtl ? 'لطفاً مشتری صاحب دستگاه را انتخاب کنید' : 'Please select a customer');
      return;
    }

    const selectedCust = allCustomers.find((c) => c.id === customerId);
    const selectedTech = allUsers.find((u) => u.id === assignedTechnicianId);
    const numEst = Number(estimatedCost.replace(/,/g, '')) || 0;
    const numFin = Number(finalCost.replace(/,/g, '')) || 0;

    const payload: RepairTicket = {
      id: ticketToEdit?.id || '',
      ticketNumber: ticketNumber.trim(),
      customerId,
      customerName: selectedCust?.name || '',
      deviceModel: deviceModel.trim(),
      imei: imei.trim() || undefined,
      serialNumber: serialNumber.trim() || undefined,
      problemDescription: problemDescription.trim(),
      technicianNotes: technicianNotes.trim() || undefined,
      status,
      estimatedCost: numEst,
      finalCost: numFin > 0 ? numFin : undefined,
      assignedTechnicianId: assignedTechnicianId || undefined,
      assignedTechnicianName: selectedTech?.name || undefined,
      receivedAt: ticketToEdit?.receivedAt || new Date().toISOString(),
      deliveredAt: status === RepairStatus.DELIVERED ? new Date().toISOString() : undefined,
      warrantyUntil: warrantyUntil ? new Date(warrantyUntil).toISOString() : undefined,
      createdAt: ticketToEdit?.createdAt || '',
      updatedAt: '',
    };

    const saved = storage.saveRepairTicket(payload);
    success(ticketToEdit ? (isRtl ? 'اطلاعات قبض تعمیرات ویرایش شد' : 'Repair ticket updated') : (isRtl ? 'قبض پذیرش تعمیرات صادر شد' : 'Repair ticket created'));
    onSaved(saved);
    onClose();
  };

  const rawEst = Number(estimatedCost.replace(/,/g, '')) || 0;
  const rawFin = Number(finalCost.replace(/,/g, '')) || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-amber-400" />
          <span>{ticketToEdit ? t('repairs.editTicketModalTitle') : t('repairs.newTicketModalTitle')}</span>
        </div>
      }
      subtitle={t('repairs.subtitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <Input
            label={t('repairs.ticketNumber')}
            value={ticketNumber}
            onChange={(e) => setTicketNumber(e.target.value)}
            isRequired
            placeholder="REP-1403-1234"
          />

          <Select
            label={t('repairs.customer')}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            isRequired
            options={(allCustomers || []).map((c) => ({
              value: c.id,
              label: `${c.name} (${c.mobile})`,
            }))}
          />

          <Select
            label={t('repairs.status')}
            value={status}
            onChange={(e) => setStatus(e.target.value as RepairStatus)}
            options={[
              { value: RepairStatus.RECEIVED, label: t('repairs.statusReceived') },
              { value: RepairStatus.DIAGNOSING, label: t('repairs.statusDiagnosing') },
              { value: RepairStatus.WAITING_PARTS, label: t('repairs.statusWaitingParts') },
              { value: RepairStatus.IN_PROGRESS, label: t('repairs.statusInProgress') },
              { value: RepairStatus.READY_DELIVERY, label: t('repairs.statusReady') },
              { value: RepairStatus.DELIVERED, label: t('repairs.statusDelivered') },
              { value: RepairStatus.UNREPAIRABLE, label: t('repairs.statusUnrepairable') },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <Input
            label={t('repairs.deviceModel')}
            value={deviceModel}
            onChange={(e) => setDeviceModel(e.target.value)}
            placeholder={isRtl ? 'مثال: مودم 5G نتربیت / گوشی آیفون 15' : 'e.g. 5G Modem / iPhone 15'}
            isRequired
          />

          <Input
            label={t('repairs.imei')}
            value={imei}
            onChange={(e) => setImei(e.target.value)}
            placeholder="356789012345678"
            className="font-mono text-xs"
          />

          <Input
            label={t('repairs.serialNumber')}
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder="SN-90218402"
            className="font-mono text-xs"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Select
            label={t('repairs.technician')}
            value={assignedTechnicianId}
            onChange={(e) => setAssignedTechnicianId(e.target.value)}
            options={[
              { value: '', label: isRtl ? 'تعیین نشده' : 'Unassigned' },
              ...(allUsers || []).map((u) => ({
                value: u.id,
                label: `${u.name} (${u.role})`,
              })),
            ]}
          />

          <JalaliDatePicker
            label={t('repairs.warranty')}
            value={warrantyUntil}
            onChange={(val) => setWarrantyUntil(val)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1">
            <Input
              label={t('repairs.estimatedCost')}
              type="number"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              placeholder="1500000"
              leftIcon={<DollarSign className="w-4 h-4 text-amber-400" />}
            />
            {rawEst > 0 && (
              <p className="text-xs text-slate-400 text-start pe-2">
                {isRtl ? 'معادل: ' : 'Equivalent: '}{formatCurrency(rawEst)}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Input
              label={t('repairs.finalCost')}
              type="number"
              value={finalCost}
              onChange={(e) => setFinalCost(e.target.value)}
              placeholder="1850000"
              leftIcon={<DollarSign className="w-4 h-4 text-emerald-400" />}
            />
            {rawFin > 0 && (
              <p className="text-xs text-emerald-400 font-semibold text-start pe-2">
                {isRtl ? 'معادل: ' : 'Equivalent: '}{formatCurrency(rawFin)}
              </p>
            )}
          </div>
        </div>

        <Textarea
          label={t('repairs.problem')}
          value={problemDescription}
          onChange={(e) => setProblemDescription(e.target.value)}
          rows={2}
          placeholder={isRtl ? 'روشن نمی‌شود، ضربه‌خوردگی، عدم آنتن‌دهی و...' : 'Does not turn on, water damage, no signal...'}
          isRequired
          actionButton={
            <VoiceInputButton
              onTranscript={(transcript) => {
                setProblemDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
              }}
            />
          }
        />

        <Textarea
          label={t('repairs.technicianNotes')}
          value={technicianNotes}
          onChange={(e) => setTechnicianNotes(e.target.value)}
          rows={2}
          placeholder={isRtl ? 'تعویض آی‌سی تغذیه، فلش فریم‌ور، تست آنتن و...' : 'Replaced power IC, flashed firmware, signal test...'}
        />

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="sm" type="submit" leftIcon={<Check className="w-4 h-4" />}>
            {ticketToEdit ? t('common.save') : t('repairs.newRepairBtn')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
