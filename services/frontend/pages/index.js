export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/alerts',
      permanent: false,
    },
  };
}

export default function Home() {
  return null;
}
