import { useAppearance } from '../../context/appearance';
import { Loader } from '../primitives/loader';

type Props = {
  textContent?: string;
};

// TODO: SLA-1968 - Create centered shared component
const Centered = ({ children }) => (
  <div style={{ margin: 'auto' }}>{children}</div>
);

export const LoadingModalContents = ({ textContent }: Props) => {
  const appearance = useAppearance();

  return (
    <div
      style={{
        minHeight: '200px',
        width: '100%',
        flexGrow: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
      }}
    >
      {textContent ? (
        <h2
          style={{
            marginBottom: '2rem',
            fontSize: '16px',
            fontWeight: 500,
            textAlign: 'center',
          }}
        >
          {textContent}
        </h2>
      ) : null}
      <Centered>
        <Loader color={appearance.modalStyle.fontColor} size={14} />
      </Centered>
    </div>
  );
};
