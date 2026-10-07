import { FuelType, OwnershipType, VehicleType, normalizeVehicleNumber } from '@zinu/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChipSelect } from '../../components/forms';
import { Button, Screen, TextField, notify } from '../../components/ui';
import { errorMessage } from '../../i18n';
import { api } from '../../lib/api';
import { useRegistration, useSetRegistration } from '../../lib/registration';
import { spacing } from '../../lib/theme';

type V = (typeof VehicleType)[keyof typeof VehicleType];
type F = (typeof FuelType)[keyof typeof FuelType];
type O = (typeof OwnershipType)[keyof typeof OwnershipType];

/** Spec §26 vehicle details and §40 ownership type. */
export default function VehicleStep() {
  const { t } = useTranslation();
  const { data: reg } = useRegistration();
  const setRegistration = useSetRegistration();
  const v = reg?.vehicle;
  const [vehicleType, setVehicleType] = useState<V | null>(v?.vehicleType ?? null);
  const [fuelType, setFuelType] = useState<F | null>(v?.fuelType ?? null);
  const [regNumber, setRegNumber] = useState(v?.registrationNumber ?? '');
  const [ownership, setOwnership] = useState<O | null>(v?.ownershipType ?? null);
  const [partner, setPartner] = useState(v?.fleetPartnerName ?? '');
  const [make, setMake] = useState(v?.make ?? '');
  const [model, setModel] = useState(v?.model ?? '');
  const [colour, setColour] = useState(v?.colour ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const pickType = (type: V) => {
    setVehicleType(type);
    if (type === 'TOTO') setFuelType('ELECTRIC'); // a Toto is always electric
  };

  const save = async () => {
    const e: Record<string, string> = {};
    if (!vehicleType) e.vehicleType = t('reg.vehicleType');
    if (!fuelType) e.fuelType = t('reg.fuelType');
    if (!normalizeVehicleNumber(regNumber)) e.regNumber = t('reg.regNumberInvalid');
    if (!ownership) e.ownership = t('reg.ownership');
    if (ownership === 'FLEET_PARTNER' && partner.trim().length < 2) e.partner = t('reg.fleetPartner');
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      setRegistration(
        await api.saveVehicle({
          vehicleType: vehicleType!,
          fuelType: fuelType!,
          registrationNumber: regNumber,
          ownershipType: ownership!,
          fleetPartnerName: ownership === 'FLEET_PARTNER' ? partner.trim() : undefined,
          make: make.trim() || undefined,
          model: model.trim() || undefined,
          colour: colour.trim() || undefined,
        }),
      );
      router.back();
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <ChipSelect
        label={t('reg.vehicleType')}
        options={Object.values(VehicleType).map((x) => ({ value: x, label: t(`reg.vehicleTypes.${x}`) }))}
        value={vehicleType}
        onChange={pickType}
        error={errors.vehicleType}
      />
      <ChipSelect
        label={t('reg.fuelType')}
        options={Object.values(FuelType).map((x) => ({ value: x, label: t(`reg.fuelTypes.${x}`), disabled: vehicleType === 'TOTO' && x !== 'ELECTRIC' }))}
        value={fuelType}
        onChange={setFuelType}
        error={errors.fuelType}
      />
      <TextField label={t('reg.regNumber')} value={regNumber} onChangeText={(x) => setRegNumber(x.toUpperCase())} autoCapitalize="characters" placeholder="JH01AB1234" maxLength={14} error={errors.regNumber} />
      <ChipSelect
        label={t('reg.ownership')}
        options={Object.values(OwnershipType).map((x) => ({ value: x, label: t(`reg.ownerships.${x}`) }))}
        value={ownership}
        onChange={setOwnership}
        error={errors.ownership}
      />
      {ownership === 'FLEET_PARTNER' && <TextField label={t('reg.fleetPartner')} value={partner} onChangeText={setPartner} error={errors.partner} />}
      <TextField label={`${t('reg.make')} (${t('common.optional')})`} value={make} onChangeText={setMake} />
      <TextField label={`${t('reg.model')} (${t('common.optional')})`} value={model} onChangeText={setModel} />
      <TextField label={`${t('reg.colour')} (${t('common.optional')})`} value={colour} onChangeText={setColour} />
      <Button label={t('common.save')} onPress={save} loading={saving} style={{ marginTop: spacing.md }} />
    </Screen>
  );
}
