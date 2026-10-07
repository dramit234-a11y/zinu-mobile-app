import { useTranslation } from 'react-i18next';
import { EmptyState, Screen } from '../../components/ui';

export default function Wallet() {
  const { t } = useTranslation();
  return (
    <Screen edges={['top']}>
      <EmptyState icon="wallet" title={t('passenger.walletTitle')} body={t('passenger.walletBody')} />
    </Screen>
  );
}
